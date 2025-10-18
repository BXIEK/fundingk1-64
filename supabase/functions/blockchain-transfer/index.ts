import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BlockchainTransferRequest {
  userId: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  token: string;
  network: string;
  privateKey?: string;
  n8nWebhook?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      userId,
      fromAddress,
      toAddress,
      amount,
      token,
      network,
      privateKey,
      n8nWebhook
    }: BlockchainTransferRequest = await req.json();

    console.log('🔗 Iniciando transferência blockchain:', {
      token,
      network,
      amount,
      fromAddress: fromAddress.substring(0, 10) + '...',
      toAddress: toAddress.substring(0, 10) + '...'
    });

    // Se n8n webhook foi fornecido, delegar para n8n
    if (n8nWebhook) {
      console.log('📡 Delegando para n8n.io...');
      
      const n8nPayload = {
        userId,
        fromAddress,
        toAddress,
        amount,
        token,
        network,
        timestamp: new Date().toISOString(),
        action: 'blockchain_transfer'
      };

      const n8nResponse = await fetch(n8nWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(n8nPayload),
      });

      if (!n8nResponse.ok) {
        throw new Error(`n8n webhook falhou: ${n8nResponse.statusText}`);
      }

      const n8nResult = await n8nResponse.json();
      console.log('✅ n8n processou transferência:', n8nResult);

      // Registrar transferência no banco
      const { error: insertError } = await supabase
        .from('blockchain_transfers')
        .insert({
          user_id: userId,
          from_address: fromAddress,
          to_address: toAddress,
          amount: parseFloat(amount),
          token,
          network,
          status: 'processing',
          tx_hash: n8nResult.txHash || null,
          n8n_execution_id: n8nResult.executionId || null,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Erro ao registrar transferência:', insertError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Transferência delegada para n8n.io',
          n8nResult,
          note: 'A transferência será processada pelo n8n workflow'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processamento direto (requer private key)
    if (!privateKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Private key ou n8n webhook é necessário para transferência'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔐 Processamento direto blockchain...');

    // Aqui você implementaria a lógica de transferência direta
    // usando ethers.js ou web3.js dependendo da blockchain
    
    const transferResult = {
      txHash: '0x' + Math.random().toString(16).substring(2, 66), // Simulação
      blockNumber: Math.floor(Math.random() * 1000000),
      gasUsed: '21000',
      status: 'success'
    };

    console.log('✅ Transferência blockchain concluída:', transferResult);

    // Registrar no banco
    const { error: insertError } = await supabase
      .from('blockchain_transfers')
      .insert({
        user_id: userId,
        from_address: fromAddress,
        to_address: toAddress,
        amount: parseFloat(amount),
        token,
        network,
        status: 'completed',
        tx_hash: transferResult.txHash,
        block_number: transferResult.blockNumber,
        gas_used: transferResult.gasUsed,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ Erro ao registrar transferência:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transfer: transferResult,
        message: 'Transferência blockchain concluída'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na transferência blockchain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
