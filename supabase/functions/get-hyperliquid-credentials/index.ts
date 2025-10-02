import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const walletAddress = Deno.env.get('HYPERLIQUID_WALLET_ADDRESS');
    const privateKey = Deno.env.get('HYPERLIQUID_PRIVATE_KEY');

    if (!walletAddress || !privateKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Hyperliquid credentials not configured in Supabase Secrets'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        credentials: {
          walletAddress,
          privateKey
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
