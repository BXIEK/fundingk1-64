export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      access_codes: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      approved_users: {
        Row: {
          access_level: string
          approved_at: string
          approved_by: string
          cpf: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_trial: boolean | null
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          approved_at?: string
          approved_by: string
          cpf?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          is_trial?: boolean | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          approved_at?: string
          approved_by?: string
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          is_trial?: boolean | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      arbitrage_bot_executions: {
        Row: {
          actual_profit: number | null
          bridge_fees: number | null
          buy_dex: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          executed_buy_price: number | null
          executed_sell_price: number | null
          execution_time_seconds: number | null
          gas_fees: number | null
          id: string
          selection_id: string
          sell_dex: string
          started_at: string
          status: string
          symbol: string
          trade_amount: number
          transaction_hashes: Json | null
          user_id: string
        }
        Insert: {
          actual_profit?: number | null
          bridge_fees?: number | null
          buy_dex: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          executed_buy_price?: number | null
          executed_sell_price?: number | null
          execution_time_seconds?: number | null
          gas_fees?: number | null
          id?: string
          selection_id: string
          sell_dex: string
          started_at?: string
          status?: string
          symbol: string
          trade_amount: number
          transaction_hashes?: Json | null
          user_id: string
        }
        Update: {
          actual_profit?: number | null
          bridge_fees?: number | null
          buy_dex?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          executed_buy_price?: number | null
          executed_sell_price?: number | null
          execution_time_seconds?: number | null
          gas_fees?: number | null
          id?: string
          selection_id?: string
          sell_dex?: string
          started_at?: string
          status?: string
          symbol?: string
          trade_amount?: number
          transaction_hashes?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arbitrage_bot_executions_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "user_arbitrage_selections"
            referencedColumns: ["id"]
          },
        ]
      }
      arbitrage_operations: {
        Row: {
          actual_profit_usd: number | null
          amount: number
          conversion_amount: number | null
          conversion_performed: boolean | null
          created_at: string
          details: Json | null
          expected_profit_usd: number | null
          from_token: string | null
          futures_price: number | null
          id: string
          operation_type: string
          spot_price: number | null
          spread_percent: number | null
          status: string
          symbol: string
          to_token: string | null
          total_costs_percent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_profit_usd?: number | null
          amount: number
          conversion_amount?: number | null
          conversion_performed?: boolean | null
          created_at?: string
          details?: Json | null
          expected_profit_usd?: number | null
          from_token?: string | null
          futures_price?: number | null
          id?: string
          operation_type: string
          spot_price?: number | null
          spread_percent?: number | null
          status?: string
          symbol: string
          to_token?: string | null
          total_costs_percent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_profit_usd?: number | null
          amount?: number
          conversion_amount?: number | null
          conversion_performed?: boolean | null
          created_at?: string
          details?: Json | null
          expected_profit_usd?: number | null
          from_token?: string | null
          futures_price?: number | null
          id?: string
          operation_type?: string
          spot_price?: number | null
          spread_percent?: number | null
          status?: string
          symbol?: string
          to_token?: string | null
          total_costs_percent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      arbitrage_trades: {
        Row: {
          buy_exchange: string
          buy_price: number
          created_at: string
          error_message: string | null
          executed_at: string | null
          execution_time_ms: number
          gas_fees: number
          gross_profit: number
          id: string
          investment_amount: number
          net_profit: number
          pionex_order_id: string | null
          quantity: number
          risk_level: string
          roi_percentage: number
          sell_exchange: string
          sell_price: number
          slippage_cost: number
          spread_percentage: number
          status: string
          symbol: string
          trading_mode: string | null
          user_id: string
        }
        Insert: {
          buy_exchange: string
          buy_price: number
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          execution_time_ms: number
          gas_fees: number
          gross_profit: number
          id?: string
          investment_amount: number
          net_profit: number
          pionex_order_id?: string | null
          quantity: number
          risk_level: string
          roi_percentage: number
          sell_exchange: string
          sell_price: number
          slippage_cost: number
          spread_percentage: number
          status?: string
          symbol: string
          trading_mode?: string | null
          user_id: string
        }
        Update: {
          buy_exchange?: string
          buy_price?: number
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          execution_time_ms?: number
          gas_fees?: number
          gross_profit?: number
          id?: string
          investment_amount?: number
          net_profit?: number
          pionex_order_id?: string | null
          quantity?: number
          risk_level?: string
          roi_percentage?: number
          sell_exchange?: string
          sell_price?: number
          slippage_cost?: number
          spread_percentage?: number
          status?: string
          symbol?: string
          trading_mode?: string | null
          user_id?: string
        }
        Relationships: []
      }
      authorized_workers: {
        Row: {
          api_key: string
          authorized_ips: unknown[] | null
          created_at: string
          id: string
          is_active: boolean
          last_activity: string | null
          miner_id: string
          updated_at: string
          worker_name: string
        }
        Insert: {
          api_key: string
          authorized_ips?: unknown[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_activity?: string | null
          miner_id: string
          updated_at?: string
          worker_name: string
        }
        Update: {
          api_key?: string
          authorized_ips?: unknown[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_activity?: string | null
          miner_id?: string
          updated_at?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_workers_miner_id_fkey"
            columns: ["miner_id"]
            isOneToOne: false
            referencedRelation: "miners"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_balance_configs: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          last_check_at: string | null
          min_crypto_threshold: number | null
          min_usdt_threshold: number | null
          rebalance_frequency_hours: number | null
          target_crypto_buffer: number | null
          target_usdt_buffer: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          last_check_at?: string | null
          min_crypto_threshold?: number | null
          min_usdt_threshold?: number | null
          rebalance_frequency_hours?: number | null
          target_crypto_buffer?: number | null
          target_usdt_buffer?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          last_check_at?: string | null
          min_crypto_threshold?: number | null
          min_usdt_threshold?: number | null
          rebalance_frequency_hours?: number | null
          target_crypto_buffer?: number | null
          target_usdt_buffer?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auto_cross_exchange_configs: {
        Row: {
          auto_rebalance_enabled: boolean
          created_at: string
          exchanges_enabled: string[]
          id: string
          is_enabled: boolean
          max_concurrent_operations: number
          max_investment_amount: number
          min_profit_threshold: number
          min_spread_percentage: number
          risk_management_level: string
          stop_loss_percentage: number | null
          symbols_filter: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_rebalance_enabled?: boolean
          created_at?: string
          exchanges_enabled?: string[]
          id?: string
          is_enabled?: boolean
          max_concurrent_operations?: number
          max_investment_amount?: number
          min_profit_threshold?: number
          min_spread_percentage?: number
          risk_management_level?: string
          stop_loss_percentage?: number | null
          symbols_filter?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_rebalance_enabled?: boolean
          created_at?: string
          exchanges_enabled?: string[]
          id?: string
          is_enabled?: boolean
          max_concurrent_operations?: number
          max_investment_amount?: number
          min_profit_threshold?: number
          min_spread_percentage?: number
          risk_management_level?: string
          stop_loss_percentage?: number | null
          symbols_filter?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_cross_executions: {
        Row: {
          actual_profit: number | null
          amount: number
          buy_exchange: string
          buy_price: number
          completed_at: string | null
          config_id: string
          deposit_fee: number | null
          error_message: string | null
          estimated_profit: number
          executed_at: string
          execution_results: Json | null
          execution_status: string
          execution_time_ms: number | null
          id: string
          sell_exchange: string
          sell_price: number
          spread_percentage: number
          symbol: string
          total_fees: number
          trading_fee_buy: number | null
          trading_fee_sell: number | null
          withdrawal_fee: number | null
        }
        Insert: {
          actual_profit?: number | null
          amount: number
          buy_exchange: string
          buy_price: number
          completed_at?: string | null
          config_id: string
          deposit_fee?: number | null
          error_message?: string | null
          estimated_profit: number
          executed_at?: string
          execution_results?: Json | null
          execution_status?: string
          execution_time_ms?: number | null
          id?: string
          sell_exchange: string
          sell_price: number
          spread_percentage: number
          symbol: string
          total_fees?: number
          trading_fee_buy?: number | null
          trading_fee_sell?: number | null
          withdrawal_fee?: number | null
        }
        Update: {
          actual_profit?: number | null
          amount?: number
          buy_exchange?: string
          buy_price?: number
          completed_at?: string | null
          config_id?: string
          deposit_fee?: number | null
          error_message?: string | null
          estimated_profit?: number
          executed_at?: string
          execution_results?: Json | null
          execution_status?: string
          execution_time_ms?: number | null
          id?: string
          sell_exchange?: string
          sell_price?: number
          spread_percentage?: number
          symbol?: string
          total_fees?: number
          trading_fee_buy?: number | null
          trading_fee_sell?: number | null
          withdrawal_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_cross_executions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "auto_cross_exchange_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_funding_configs: {
        Row: {
          auto_close_after_funding: boolean
          created_at: string
          id: string
          is_enabled: boolean
          max_investment_per_trade: number
          min_funding_rate: number
          min_profit_threshold: number
          symbols: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_close_after_funding?: boolean
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_investment_per_trade?: number
          min_funding_rate?: number
          min_profit_threshold?: number
          symbols?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_close_after_funding?: boolean
          created_at?: string
          id?: string
          is_enabled?: boolean
          max_investment_per_trade?: number
          min_funding_rate?: number
          min_profit_threshold?: number
          symbols?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_funding_executions: {
        Row: {
          created_at: string
          execution_results: Json | null
          execution_time: string
          id: string
          total_configs_active: number
          total_opportunities_found: number
          total_trades_executed: number
          trigger_type: string
        }
        Insert: {
          created_at?: string
          execution_results?: Json | null
          execution_time?: string
          id?: string
          total_configs_active?: number
          total_opportunities_found?: number
          total_trades_executed?: number
          trigger_type?: string
        }
        Update: {
          created_at?: string
          execution_results?: Json | null
          execution_time?: string
          id?: string
          total_configs_active?: number
          total_opportunities_found?: number
          total_trades_executed?: number
          trigger_type?: string
        }
        Relationships: []
      }
      automated_trade_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          executed_steps: Json | null
          execution_plan: Json
          execution_time_ms: number | null
          id: string
          rollback_executed: boolean | null
          rollback_reason: string | null
          security_score: number | null
          status: string
          total_fees: number | null
          total_profit: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          executed_steps?: Json | null
          execution_plan: Json
          execution_time_ms?: number | null
          id?: string
          rollback_executed?: boolean | null
          rollback_reason?: string | null
          security_score?: number | null
          status?: string
          total_fees?: number | null
          total_profit?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          executed_steps?: Json | null
          execution_plan?: Json
          execution_time_ms?: number | null
          id?: string
          rollback_executed?: boolean | null
          rollback_reason?: string | null
          security_score?: number | null
          status?: string
          total_fees?: number | null
          total_profit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      automated_trade_executions_simulated: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          executed_steps: Json | null
          execution_plan: Json
          execution_time_ms: number | null
          id: string
          rollback_executed: boolean | null
          rollback_reason: string | null
          security_score: number | null
          status: string
          total_fees: number | null
          total_profit: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          executed_steps?: Json | null
          execution_plan: Json
          execution_time_ms?: number | null
          id?: string
          rollback_executed?: boolean | null
          rollback_reason?: string | null
          security_score?: number | null
          status?: string
          total_fees?: number | null
          total_profit?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          executed_steps?: Json | null
          execution_plan?: Json
          execution_time_ms?: number | null
          id?: string
          rollback_executed?: boolean | null
          rollback_reason?: string | null
          security_score?: number | null
          status?: string
          total_fees?: number | null
          total_profit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      campaign_templates: {
        Row: {
          campaign_type: string
          content_types: Json
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          suggested_budget: number
          suggested_duration: number
          suggested_platforms: Json
          target_audience: string
          template_data: Json
          updated_at: string
        }
        Insert: {
          campaign_type: string
          content_types?: Json
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          name: string
          suggested_budget?: number
          suggested_duration?: number
          suggested_platforms?: Json
          target_audience: string
          template_data?: Json
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          content_types?: Json
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          suggested_budget?: number
          suggested_duration?: number
          suggested_platforms?: Json
          target_audience?: string
          template_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      cex_cex_arbitrage_opportunities: {
        Row: {
          buy_exchange: string
          buy_price: number
          created_at: string
          deposit_fee: number | null
          execution_time_estimate: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          liquidity_score: number | null
          minimum_trade_amount: number | null
          net_profit_usd: number
          risk_level: string
          roi_percentage: number
          sell_exchange: string
          sell_price: number
          spread_percentage: number
          symbol: string
          transfer_fee: number | null
          updated_at: string
          volume_24h: number | null
          withdrawal_fee: number | null
        }
        Insert: {
          buy_exchange: string
          buy_price: number
          created_at?: string
          deposit_fee?: number | null
          execution_time_estimate?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          liquidity_score?: number | null
          minimum_trade_amount?: number | null
          net_profit_usd: number
          risk_level: string
          roi_percentage: number
          sell_exchange: string
          sell_price: number
          spread_percentage: number
          symbol: string
          transfer_fee?: number | null
          updated_at?: string
          volume_24h?: number | null
          withdrawal_fee?: number | null
        }
        Update: {
          buy_exchange?: string
          buy_price?: number
          created_at?: string
          deposit_fee?: number | null
          execution_time_estimate?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          liquidity_score?: number | null
          minimum_trade_amount?: number | null
          net_profit_usd?: number
          risk_level?: string
          roi_percentage?: number
          sell_exchange?: string
          sell_price?: number
          spread_percentage?: number
          symbol?: string
          transfer_fee?: number | null
          updated_at?: string
          volume_24h?: number | null
          withdrawal_fee?: number | null
        }
        Relationships: []
      }
      cex_dex_arbitrage_opportunities: {
        Row: {
          bridge_fee: number | null
          cex_deposit_fee: number | null
          cex_exchange: string
          cex_price: number
          cex_trading_fee: number | null
          cex_withdrawal_fee: number | null
          created_at: string
          dex_gas_fee_usd: number | null
          dex_name: string
          dex_price: number
          dex_trading_fee: number | null
          direction: string
          estimated_time_minutes: number | null
          execution_complexity: string | null
          expires_at: string | null
          gross_profit_usd: number | null
          id: string
          liquidity_score: number | null
          min_investment_usd: number | null
          net_profit_usd: number | null
          network: string
          risk_level: string | null
          roi_percentage: number | null
          slippage_percent: number | null
          spread_percentage: number
          symbol: string
          total_fees_usd: number | null
          updated_at: string
        }
        Insert: {
          bridge_fee?: number | null
          cex_deposit_fee?: number | null
          cex_exchange: string
          cex_price: number
          cex_trading_fee?: number | null
          cex_withdrawal_fee?: number | null
          created_at?: string
          dex_gas_fee_usd?: number | null
          dex_name: string
          dex_price: number
          dex_trading_fee?: number | null
          direction: string
          estimated_time_minutes?: number | null
          execution_complexity?: string | null
          expires_at?: string | null
          gross_profit_usd?: number | null
          id?: string
          liquidity_score?: number | null
          min_investment_usd?: number | null
          net_profit_usd?: number | null
          network: string
          risk_level?: string | null
          roi_percentage?: number | null
          slippage_percent?: number | null
          spread_percentage: number
          symbol: string
          total_fees_usd?: number | null
          updated_at?: string
        }
        Update: {
          bridge_fee?: number | null
          cex_deposit_fee?: number | null
          cex_exchange?: string
          cex_price?: number
          cex_trading_fee?: number | null
          cex_withdrawal_fee?: number | null
          created_at?: string
          dex_gas_fee_usd?: number | null
          dex_name?: string
          dex_price?: number
          dex_trading_fee?: number | null
          direction?: string
          estimated_time_minutes?: number | null
          execution_complexity?: string | null
          expires_at?: string | null
          gross_profit_usd?: number | null
          id?: string
          liquidity_score?: number | null
          min_investment_usd?: number | null
          net_profit_usd?: number | null
          network?: string
          risk_level?: string | null
          roi_percentage?: number | null
          slippage_percent?: number | null
          spread_percentage?: number
          symbol?: string
          total_fees_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cex_dex_arbitrage_opportunities_simulated: {
        Row: {
          cex_exchange: string
          cex_price: number
          created_at: string
          deposit_fee: number | null
          dex_name: string
          dex_price: number
          execution_time_estimate: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          liquidity_score: number | null
          minimum_trade_amount: number | null
          net_profit_usd: number
          network: string | null
          risk_level: string
          roi_percentage: number
          spread_percentage: number
          symbol: string
          transfer_fee: number | null
          updated_at: string
          volume_24h: number | null
          withdrawal_fee: number | null
        }
        Insert: {
          cex_exchange?: string
          cex_price: number
          created_at?: string
          deposit_fee?: number | null
          dex_name?: string
          dex_price: number
          execution_time_estimate?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          liquidity_score?: number | null
          minimum_trade_amount?: number | null
          net_profit_usd: number
          network?: string | null
          risk_level: string
          roi_percentage: number
          spread_percentage: number
          symbol: string
          transfer_fee?: number | null
          updated_at?: string
          volume_24h?: number | null
          withdrawal_fee?: number | null
        }
        Update: {
          cex_exchange?: string
          cex_price?: number
          created_at?: string
          deposit_fee?: number | null
          dex_name?: string
          dex_price?: number
          execution_time_estimate?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          liquidity_score?: number | null
          minimum_trade_amount?: number | null
          net_profit_usd?: number
          network?: string | null
          risk_level?: string
          roi_percentage?: number
          spread_percentage?: number
          symbol?: string
          transfer_fee?: number | null
          updated_at?: string
          volume_24h?: number | null
          withdrawal_fee?: number | null
        }
        Relationships: []
      }
      data_quality_logs: {
        Row: {
          created_at: string
          detected_at: string
          exchange_prices: Json
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          spread_percentage: number
          symbol: string
        }
        Insert: {
          created_at?: string
          detected_at?: string
          exchange_prices: Json
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity: string
          spread_percentage: number
          symbol: string
        }
        Update: {
          created_at?: string
          detected_at?: string
          exchange_prices?: Json
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          spread_percentage?: number
          symbol?: string
        }
        Relationships: []
      }
      derivatives_data: {
        Row: {
          avg_funding_rate: number | null
          change_24h: number | null
          contract_type: string
          created_at: string
          exchange: string
          funding_rate: number | null
          funding_sentiment: string | null
          funding_trend: number | null
          funding_volatility: number | null
          id: string
          index_price: number | null
          liquidation_risk: string | null
          liquidity_risk: string | null
          long_short_ratio: string | null
          mark_price: number | null
          market_efficiency: string | null
          market_stress: string | null
          next_funding_time: number | null
          open_interest: number | null
          open_interest_trend: number | null
          premium: number | null
          price: number
          symbol: string
          timestamp: string
          updated_at: string
          volatility_risk: string | null
          volume_24h: number | null
        }
        Insert: {
          avg_funding_rate?: number | null
          change_24h?: number | null
          contract_type?: string
          created_at?: string
          exchange: string
          funding_rate?: number | null
          funding_sentiment?: string | null
          funding_trend?: number | null
          funding_volatility?: number | null
          id?: string
          index_price?: number | null
          liquidation_risk?: string | null
          liquidity_risk?: string | null
          long_short_ratio?: string | null
          mark_price?: number | null
          market_efficiency?: string | null
          market_stress?: string | null
          next_funding_time?: number | null
          open_interest?: number | null
          open_interest_trend?: number | null
          premium?: number | null
          price: number
          symbol: string
          timestamp?: string
          updated_at?: string
          volatility_risk?: string | null
          volume_24h?: number | null
        }
        Update: {
          avg_funding_rate?: number | null
          change_24h?: number | null
          contract_type?: string
          created_at?: string
          exchange?: string
          funding_rate?: number | null
          funding_sentiment?: string | null
          funding_trend?: number | null
          funding_volatility?: number | null
          id?: string
          index_price?: number | null
          liquidation_risk?: string | null
          liquidity_risk?: string | null
          long_short_ratio?: string | null
          mark_price?: number | null
          market_efficiency?: string | null
          market_stress?: string | null
          next_funding_time?: number | null
          open_interest?: number | null
          open_interest_trend?: number | null
          premium?: number | null
          price?: number
          symbol?: string
          timestamp?: string
          updated_at?: string
          volatility_risk?: string | null
          volume_24h?: number | null
        }
        Relationships: []
      }
      derivatives_market_metrics: {
        Row: {
          avg_funding_rate: number | null
          avg_funding_volatility: number | null
          avg_premium: number | null
          bearish_contracts: number | null
          bullish_contracts: number | null
          contracts_count: number | null
          created_at: string
          exchange: string
          extreme_risk_contracts: number | null
          high_risk_contracts: number | null
          id: string
          market_sentiment: string | null
          overleveraged_long: number | null
          overleveraged_short: number | null
          systemic_risk: string | null
          timestamp: string
          total_open_interest: number | null
          total_volume_24h: number | null
          updated_at: string
          volatility_regime: string | null
        }
        Insert: {
          avg_funding_rate?: number | null
          avg_funding_volatility?: number | null
          avg_premium?: number | null
          bearish_contracts?: number | null
          bullish_contracts?: number | null
          contracts_count?: number | null
          created_at?: string
          exchange: string
          extreme_risk_contracts?: number | null
          high_risk_contracts?: number | null
          id?: string
          market_sentiment?: string | null
          overleveraged_long?: number | null
          overleveraged_short?: number | null
          systemic_risk?: string | null
          timestamp?: string
          total_open_interest?: number | null
          total_volume_24h?: number | null
          updated_at?: string
          volatility_regime?: string | null
        }
        Update: {
          avg_funding_rate?: number | null
          avg_funding_volatility?: number | null
          avg_premium?: number | null
          bearish_contracts?: number | null
          bullish_contracts?: number | null
          contracts_count?: number | null
          created_at?: string
          exchange?: string
          extreme_risk_contracts?: number | null
          high_risk_contracts?: number | null
          id?: string
          market_sentiment?: string | null
          overleveraged_long?: number | null
          overleveraged_short?: number | null
          systemic_risk?: string | null
          timestamp?: string
          total_open_interest?: number | null
          total_volume_24h?: number | null
          updated_at?: string
          volatility_regime?: string | null
        }
        Relationships: []
      }
      dex_dex_arbitrage_opportunities: {
        Row: {
          bridge_fee_estimate: number | null
          buy_dex: string
          buy_network: string
          buy_price: number
          created_at: string
          execution_time_estimate: number | null
          expires_at: string | null
          gas_fee_estimate: number | null
          id: string
          is_active: boolean
          liquidity_usd: number | null
          net_profit_usd: number
          pool_address_buy: string | null
          pool_address_sell: string | null
          risk_level: string
          roi_percentage: number
          sell_dex: string
          sell_network: string
          sell_price: number
          slippage_estimate: number | null
          spread_percentage: number
          symbol: string
          updated_at: string
        }
        Insert: {
          bridge_fee_estimate?: number | null
          buy_dex: string
          buy_network: string
          buy_price: number
          created_at?: string
          execution_time_estimate?: number | null
          expires_at?: string | null
          gas_fee_estimate?: number | null
          id?: string
          is_active?: boolean
          liquidity_usd?: number | null
          net_profit_usd: number
          pool_address_buy?: string | null
          pool_address_sell?: string | null
          risk_level: string
          roi_percentage: number
          sell_dex: string
          sell_network: string
          sell_price: number
          slippage_estimate?: number | null
          spread_percentage: number
          symbol: string
          updated_at?: string
        }
        Update: {
          bridge_fee_estimate?: number | null
          buy_dex?: string
          buy_network?: string
          buy_price?: number
          created_at?: string
          execution_time_estimate?: number | null
          expires_at?: string | null
          gas_fee_estimate?: number | null
          id?: string
          is_active?: boolean
          liquidity_usd?: number | null
          net_profit_usd?: number
          pool_address_buy?: string | null
          pool_address_sell?: string | null
          risk_level?: string
          roi_percentage?: number
          sell_dex?: string
          sell_network?: string
          sell_price?: number
          slippage_estimate?: number | null
          spread_percentage?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      dex_positions: {
        Row: {
          created_at: string
          dex_name: string
          fees_earned_usd: number | null
          id: string
          is_active: boolean | null
          liquidity_value_usd: number | null
          network: string
          position_id: string | null
          token0_address: string | null
          token0_amount: number | null
          token0_symbol: string | null
          token1_address: string | null
          token1_amount: number | null
          token1_symbol: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          dex_name: string
          fees_earned_usd?: number | null
          id?: string
          is_active?: boolean | null
          liquidity_value_usd?: number | null
          network: string
          position_id?: string | null
          token0_address?: string | null
          token0_amount?: number | null
          token0_symbol?: string | null
          token1_address?: string | null
          token1_amount?: number | null
          token1_symbol?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          dex_name?: string
          fees_earned_usd?: number | null
          id?: string
          is_active?: boolean | null
          liquidity_value_usd?: number | null
          network?: string
          position_id?: string | null
          token0_address?: string | null
          token0_amount?: number | null
          token0_symbol?: string | null
          token1_address?: string | null
          token1_amount?: number | null
          token1_symbol?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      exchange_api_configs: {
        Row: {
          api_key: string
          created_at: string
          exchange: string
          id: string
          is_active: boolean
          is_testnet: boolean
          passphrase: string | null
          secret_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          exchange: string
          id?: string
          is_active?: boolean
          is_testnet?: boolean
          passphrase?: string | null
          secret_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          exchange?: string
          id?: string
          is_active?: boolean
          is_testnet?: boolean
          passphrase?: string | null
          secret_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exchange_api_health: {
        Row: {
          consecutive_failures: number | null
          created_at: string
          exchange: string
          health_score: number
          id: string
          is_operational: boolean
          last_check_at: string
          last_error: string | null
          response_time_ms: number | null
        }
        Insert: {
          consecutive_failures?: number | null
          created_at?: string
          exchange: string
          health_score?: number
          id?: string
          is_operational?: boolean
          last_check_at?: string
          last_error?: string | null
          response_time_ms?: number | null
        }
        Update: {
          consecutive_failures?: number | null
          created_at?: string
          exchange?: string
          health_score?: number
          id?: string
          is_operational?: boolean
          last_check_at?: string
          last_error?: string | null
          response_time_ms?: number | null
        }
        Relationships: []
      }
      exchange_fees: {
        Row: {
          created_at: string
          exchange: string
          fee_amount: number
          fee_percentage: number
          fee_type: string
          id: string
          is_fixed_fee: boolean
          last_updated: string
          network: string
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exchange: string
          fee_amount?: number
          fee_percentage?: number
          fee_type: string
          id?: string
          is_fixed_fee?: boolean
          last_updated?: string
          network: string
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exchange?: string
          fee_amount?: number
          fee_percentage?: number
          fee_type?: string
          id?: string
          is_fixed_fee?: boolean
          last_updated?: string
          network?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      exchange_proxy_configs: {
        Row: {
          connection_errors: number | null
          created_at: string | null
          exchange: string
          id: string
          last_successful_connection: string | null
          proxy_enabled: boolean | null
          proxy_url: string | null
          updated_at: string | null
        }
        Insert: {
          connection_errors?: number | null
          created_at?: string | null
          exchange: string
          id?: string
          last_successful_connection?: string | null
          proxy_enabled?: boolean | null
          proxy_url?: string | null
          updated_at?: string | null
        }
        Update: {
          connection_errors?: number | null
          created_at?: string | null
          exchange?: string
          id?: string
          last_successful_connection?: string | null
          proxy_enabled?: boolean | null
          proxy_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      exchange_security_ratings: {
        Row: {
          created_at: string
          exchange_name: string
          exchange_type: string
          has_insurance: boolean | null
          id: string
          is_active: boolean | null
          is_regulated: boolean | null
          known_issues: string[] | null
          last_security_check: string | null
          regulatory_jurisdictions: string[] | null
          requires_kyc: boolean | null
          security_score: number
          trust_level: string
          updated_at: string
          verification_sources: string[] | null
          website_url: string | null
        }
        Insert: {
          created_at?: string
          exchange_name: string
          exchange_type: string
          has_insurance?: boolean | null
          id?: string
          is_active?: boolean | null
          is_regulated?: boolean | null
          known_issues?: string[] | null
          last_security_check?: string | null
          regulatory_jurisdictions?: string[] | null
          requires_kyc?: boolean | null
          security_score?: number
          trust_level?: string
          updated_at?: string
          verification_sources?: string[] | null
          website_url?: string | null
        }
        Update: {
          created_at?: string
          exchange_name?: string
          exchange_type?: string
          has_insurance?: boolean | null
          id?: string
          is_active?: boolean | null
          is_regulated?: boolean | null
          known_issues?: string[] | null
          last_security_check?: string | null
          regulatory_jurisdictions?: string[] | null
          requires_kyc?: boolean | null
          security_score?: number
          trust_level?: string
          updated_at?: string
          verification_sources?: string[] | null
          website_url?: string | null
        }
        Relationships: []
      }
      exchange_symbol_mappings: {
        Row: {
          base_symbol: string
          created_at: string
          exchange: string
          exchange_symbol: string
          id: string
          is_active: boolean
          last_seen: string
          updated_at: string
        }
        Insert: {
          base_symbol: string
          created_at?: string
          exchange: string
          exchange_symbol: string
          id?: string
          is_active?: boolean
          last_seen?: string
          updated_at?: string
        }
        Update: {
          base_symbol?: string
          created_at?: string
          exchange?: string
          exchange_symbol?: string
          id?: string
          is_active?: boolean
          last_seen?: string
          updated_at?: string
        }
        Relationships: []
      }
      exchange_transaction_costs: {
        Row: {
          created_at: string
          deposit_fee_fixed: number | null
          deposit_fee_percentage: number | null
          exchange: string
          id: string
          is_active: boolean
          last_updated: string
          minimum_withdrawal: number | null
          network: string | null
          processing_time_minutes: number | null
          symbol: string
          trading_fee_maker: number | null
          trading_fee_taker: number | null
          withdrawal_fee_fixed: number | null
          withdrawal_fee_percentage: number | null
        }
        Insert: {
          created_at?: string
          deposit_fee_fixed?: number | null
          deposit_fee_percentage?: number | null
          exchange: string
          id?: string
          is_active?: boolean
          last_updated?: string
          minimum_withdrawal?: number | null
          network?: string | null
          processing_time_minutes?: number | null
          symbol: string
          trading_fee_maker?: number | null
          trading_fee_taker?: number | null
          withdrawal_fee_fixed?: number | null
          withdrawal_fee_percentage?: number | null
        }
        Update: {
          created_at?: string
          deposit_fee_fixed?: number | null
          deposit_fee_percentage?: number | null
          exchange?: string
          id?: string
          is_active?: boolean
          last_updated?: string
          minimum_withdrawal?: number | null
          network?: string | null
          processing_time_minutes?: number | null
          symbol?: string
          trading_fee_maker?: number | null
          trading_fee_taker?: number | null
          withdrawal_fee_fixed?: number | null
          withdrawal_fee_percentage?: number | null
        }
        Relationships: []
      }
      exchange_wallet_addresses: {
        Row: {
          address: string
          created_at: string
          exchange: string
          id: string
          is_active: boolean
          network: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          exchange: string
          id?: string
          is_active?: boolean
          network?: string
          symbol?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          exchange?: string
          id?: string
          is_active?: boolean
          network?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gaia_node_config: {
        Row: {
          api_port: number | null
          chain_id: string | null
          created_at: string | null
          grpc_port: number | null
          id: string
          is_active: boolean | null
          moniker: string | null
          node_name: string
          p2p_port: number | null
          rpc_endpoint: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          api_port?: number | null
          chain_id?: string | null
          created_at?: string | null
          grpc_port?: number | null
          id?: string
          is_active?: boolean | null
          moniker?: string | null
          node_name?: string
          p2p_port?: number | null
          rpc_endpoint: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          api_port?: number | null
          chain_id?: string | null
          created_at?: string | null
          grpc_port?: number | null
          id?: string
          is_active?: boolean | null
          moniker?: string | null
          node_name?: string
          p2p_port?: number | null
          rpc_endpoint?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      gaia_node_metrics: {
        Row: {
          block_height: number
          cpu_usage: number | null
          disk_usage: number | null
          id: string
          is_catching_up: boolean | null
          memory_usage: number | null
          network_in_mbps: number | null
          network_out_mbps: number | null
          node_config_id: string | null
          peers_connected: number | null
          sync_percentage: number | null
          timestamp: string | null
          validator_voting_power: number | null
        }
        Insert: {
          block_height: number
          cpu_usage?: number | null
          disk_usage?: number | null
          id?: string
          is_catching_up?: boolean | null
          memory_usage?: number | null
          network_in_mbps?: number | null
          network_out_mbps?: number | null
          node_config_id?: string | null
          peers_connected?: number | null
          sync_percentage?: number | null
          timestamp?: string | null
          validator_voting_power?: number | null
        }
        Update: {
          block_height?: number
          cpu_usage?: number | null
          disk_usage?: number | null
          id?: string
          is_catching_up?: boolean | null
          memory_usage?: number | null
          network_in_mbps?: number | null
          network_out_mbps?: number | null
          node_config_id?: string | null
          peers_connected?: number | null
          sync_percentage?: number | null
          timestamp?: string | null
          validator_voting_power?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gaia_node_metrics_node_config_id_fkey"
            columns: ["node_config_id"]
            isOneToOne: false
            referencedRelation: "gaia_node_config"
            referencedColumns: ["id"]
          },
        ]
      }
      gaia_peers: {
        Row: {
          connection_status: string | null
          created_at: string | null
          id: string
          last_seen: string | null
          moniker: string | null
          node_config_id: string | null
          peer_id: string
          remote_ip: unknown | null
        }
        Insert: {
          connection_status?: string | null
          created_at?: string | null
          id?: string
          last_seen?: string | null
          moniker?: string | null
          node_config_id?: string | null
          peer_id: string
          remote_ip?: unknown | null
        }
        Update: {
          connection_status?: string | null
          created_at?: string | null
          id?: string
          last_seen?: string | null
          moniker?: string | null
          node_config_id?: string | null
          peer_id?: string
          remote_ip?: unknown | null
        }
        Relationships: [
          {
            foreignKeyName: "gaia_peers_node_config_id_fkey"
            columns: ["node_config_id"]
            isOneToOne: false
            referencedRelation: "gaia_node_config"
            referencedColumns: ["id"]
          },
        ]
      }
      gaia_system_logs: {
        Row: {
          details: Json | null
          id: string
          log_level: string
          message: string
          module: string
          node_config_id: string | null
          timestamp: string | null
        }
        Insert: {
          details?: Json | null
          id?: string
          log_level: string
          message: string
          module: string
          node_config_id?: string | null
          timestamp?: string | null
        }
        Update: {
          details?: Json | null
          id?: string
          log_level?: string
          message?: string
          module?: string
          node_config_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gaia_system_logs_node_config_id_fkey"
            columns: ["node_config_id"]
            isOneToOne: false
            referencedRelation: "gaia_node_config"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_prices: {
        Row: {
          close_price: number
          created_at: string
          high_price: number
          id: string
          low_price: number
          open_price: number
          symbol: string
          timestamp: string
          updated_at: string
          volume: number
        }
        Insert: {
          close_price: number
          created_at?: string
          high_price: number
          id?: string
          low_price: number
          open_price: number
          symbol: string
          timestamp: string
          updated_at?: string
          volume: number
        }
        Update: {
          close_price?: number
          created_at?: string
          high_price?: number
          id?: string
          low_price?: number
          open_price?: number
          symbol?: string
          timestamp?: string
          updated_at?: string
          volume?: number
        }
        Relationships: []
      }
      hourly_prices: {
        Row: {
          change_24h: number | null
          created_at: string
          id: string
          predicted_price: number | null
          price: number
          symbol: string
          timestamp: string
          volume: number | null
        }
        Insert: {
          change_24h?: number | null
          created_at?: string
          id?: string
          predicted_price?: number | null
          price: number
          symbol: string
          timestamp?: string
          volume?: number | null
        }
        Update: {
          change_24h?: number | null
          created_at?: string
          id?: string
          predicted_price?: number | null
          price?: number
          symbol?: string
          timestamp?: string
          volume?: number | null
        }
        Relationships: []
      }
      hybrid_strategy_tracking: {
        Row: {
          active_hours: number | null
          created_at: string
          cross_exchange_operations: number | null
          cross_exchange_profit: number | null
          date: string
          funding_operations: number | null
          funding_profit: number | null
          id: string
          missed_opportunities: number | null
          net_profit: number | null
          roi_percentage: number | null
          total_fees: number | null
          total_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_hours?: number | null
          created_at?: string
          cross_exchange_operations?: number | null
          cross_exchange_profit?: number | null
          date?: string
          funding_operations?: number | null
          funding_profit?: number | null
          id?: string
          missed_opportunities?: number | null
          net_profit?: number | null
          roi_percentage?: number | null
          total_fees?: number | null
          total_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_hours?: number | null
          created_at?: string
          cross_exchange_operations?: number | null
          cross_exchange_profit?: number | null
          date?: string
          funding_operations?: number | null
          funding_profit?: number | null
          id?: string
          missed_opportunities?: number | null
          net_profit?: number | null
          roi_percentage?: number | null
          total_fees?: number | null
          total_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_dominance_history: {
        Row: {
          altcoin_dominance: number | null
          btc_dominance: number
          btc_market_cap: number | null
          created_at: string
          data_source: string
          date: string
          dominance_change_24h: number | null
          eth_dominance: number | null
          id: string
          total_market_cap: number | null
          updated_at: string
        }
        Insert: {
          altcoin_dominance?: number | null
          btc_dominance: number
          btc_market_cap?: number | null
          created_at?: string
          data_source?: string
          date: string
          dominance_change_24h?: number | null
          eth_dominance?: number | null
          id?: string
          total_market_cap?: number | null
          updated_at?: string
        }
        Update: {
          altcoin_dominance?: number | null
          btc_dominance?: number
          btc_market_cap?: number | null
          created_at?: string
          data_source?: string
          date?: string
          dominance_change_24h?: number | null
          eth_dominance?: number | null
          id?: string
          total_market_cap?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      market_prices_validation: {
        Row: {
          created_at: string
          id: string
          last_updated: string
          market_cap: number | null
          percent_change_24h: number | null
          price_usd: number
          source: string
          symbol: string
          volume_24h: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated?: string
          market_cap?: number | null
          percent_change_24h?: number | null
          price_usd: number
          source?: string
          symbol: string
          volume_24h?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          last_updated?: string
          market_cap?: number | null
          percent_change_24h?: number | null
          price_usd?: number
          source?: string
          symbol?: string
          volume_24h?: number | null
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          budget: number
          campaign_type: string
          content_types: Json
          created_at: string
          description: string | null
          duration_days: number
          ends_at: string | null
          id: string
          metrics: Json | null
          name: string
          settings: Json | null
          starts_at: string | null
          status: string
          target_audience: string | null
          target_platforms: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number
          campaign_type: string
          content_types?: Json
          created_at?: string
          description?: string | null
          duration_days?: number
          ends_at?: string | null
          id?: string
          metrics?: Json | null
          name: string
          settings?: Json | null
          starts_at?: string | null
          status?: string
          target_audience?: string | null
          target_platforms?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number
          campaign_type?: string
          content_types?: Json
          created_at?: string
          description?: string | null
          duration_days?: number
          ends_at?: string | null
          id?: string
          metrics?: Json | null
          name?: string
          settings?: Json | null
          starts_at?: string | null
          status?: string
          target_audience?: string | null
          target_platforms?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_content: {
        Row: {
          ai_prompt: string | null
          campaign_id: string | null
          content_style: string
          content_text: string
          content_theme: string
          created_at: string
          generation_cost: number | null
          hashtags: string | null
          id: string
          image_url: string | null
          metrics: Json | null
          platform: string
          published_at: string | null
          scheduled_for: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_prompt?: string | null
          campaign_id?: string | null
          content_style: string
          content_text: string
          content_theme: string
          created_at?: string
          generation_cost?: number | null
          hashtags?: string | null
          id?: string
          image_url?: string | null
          metrics?: Json | null
          platform: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_prompt?: string | null
          campaign_id?: string | null
          content_style?: string
          content_text?: string
          content_theme?: string
          created_at?: string
          generation_cost?: number | null
          hashtags?: string | null
          id?: string
          image_url?: string | null
          metrics?: Json | null
          platform?: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_content_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_metrics_daily: {
        Row: {
          campaign_id: string | null
          clicks: number | null
          content_id: string | null
          conversions: number | null
          cost: number | null
          created_at: string
          date: string
          engagement: number | null
          id: string
          impressions: number | null
          platform: string
          reach: number | null
          revenue: number | null
        }
        Insert: {
          campaign_id?: string | null
          clicks?: number | null
          content_id?: string | null
          conversions?: number | null
          cost?: number | null
          created_at?: string
          date: string
          engagement?: number | null
          id?: string
          impressions?: number | null
          platform: string
          reach?: number | null
          revenue?: number | null
        }
        Update: {
          campaign_id?: string | null
          clicks?: number | null
          content_id?: string | null
          conversions?: number | null
          cost?: number | null
          created_at?: string
          date?: string
          engagement?: number | null
          id?: string
          impressions?: number | null
          platform?: string
          reach?: number | null
          revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_metrics_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_metrics_daily_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "marketing_content"
            referencedColumns: ["id"]
          },
        ]
      }
      miner_payments: {
        Row: {
          amount_quai: number
          block_height: number | null
          id: string
          miner_id: string
          payment_date: string | null
          status: string | null
          transaction_hash: string | null
        }
        Insert: {
          amount_quai: number
          block_height?: number | null
          id?: string
          miner_id: string
          payment_date?: string | null
          status?: string | null
          transaction_hash?: string | null
        }
        Update: {
          amount_quai?: number
          block_height?: number | null
          id?: string
          miner_id?: string
          payment_date?: string | null
          status?: string | null
          transaction_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "miner_payments_miner_id_fkey"
            columns: ["miner_id"]
            isOneToOne: false
            referencedRelation: "miners"
            referencedColumns: ["id"]
          },
        ]
      }
      miners: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          last_share_at: string | null
          total_blocks_found: number | null
          total_earnings_quai: number | null
          total_hashrate_gh: number | null
          total_shares_accepted: number | null
          total_shares_submitted: number | null
          updated_at: string | null
          user_id: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          last_share_at?: string | null
          total_blocks_found?: number | null
          total_earnings_quai?: number | null
          total_hashrate_gh?: number | null
          total_shares_accepted?: number | null
          total_shares_submitted?: number | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          last_share_at?: string | null
          total_blocks_found?: number | null
          total_earnings_quai?: number | null
          total_hashrate_gh?: number | null
          total_shares_accepted?: number | null
          total_shares_submitted?: number | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      mining_shares: {
        Row: {
          block_height: number | null
          difficulty: number
          id: string
          is_block: boolean | null
          is_valid: boolean | null
          miner_id: string
          share_hash: string
          submitted_at: string | null
          worker_id: string
        }
        Insert: {
          block_height?: number | null
          difficulty: number
          id?: string
          is_block?: boolean | null
          is_valid?: boolean | null
          miner_id: string
          share_hash: string
          submitted_at?: string | null
          worker_id: string
        }
        Update: {
          block_height?: number | null
          difficulty?: number
          id?: string
          is_block?: boolean | null
          is_valid?: boolean | null
          miner_id?: string
          share_hash?: string
          submitted_at?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_shares_miner_id_fkey"
            columns: ["miner_id"]
            isOneToOne: false
            referencedRelation: "miners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mining_shares_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "mining_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      mining_workers: {
        Row: {
          created_at: string | null
          current_hashrate_gh: number | null
          id: string
          is_online: boolean | null
          last_share_at: string | null
          miner_id: string
          shares_accepted: number | null
          shares_submitted: number | null
          updated_at: string | null
          worker_name: string
        }
        Insert: {
          created_at?: string | null
          current_hashrate_gh?: number | null
          id?: string
          is_online?: boolean | null
          last_share_at?: string | null
          miner_id: string
          shares_accepted?: number | null
          shares_submitted?: number | null
          updated_at?: string | null
          worker_name: string
        }
        Update: {
          created_at?: string | null
          current_hashrate_gh?: number | null
          id?: string
          is_online?: boolean | null
          last_share_at?: string | null
          miner_id?: string
          shares_accepted?: number | null
          shares_submitted?: number | null
          updated_at?: string | null
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "mining_workers_miner_id_fkey"
            columns: ["miner_id"]
            isOneToOne: false
            referencedRelation: "miners"
            referencedColumns: ["id"]
          },
        ]
      }
      moving_averages: {
        Row: {
          created_at: string
          date: string
          id: string
          ma_200: number | null
          ma_21: number | null
          ma_30: number | null
          ma_7: number | null
          ma_90: number | null
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          ma_200?: number | null
          ma_21?: number | null
          ma_30?: number | null
          ma_7?: number | null
          ma_90?: number | null
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          ma_200?: number | null
          ma_21?: number | null
          ma_30?: number | null
          ma_7?: number | null
          ma_90?: number | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      okx_whitelist_ips: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ip_address: unknown
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ip_address: unknown
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_payments: {
        Row: {
          admin_notes: string | null
          amount_brl: number
          amount_usd: number
          created_at: string
          expires_at: string
          id: string
          installment_amount: number | null
          installments: number | null
          mercado_pago_payment_id: string | null
          payment_method: string
          payment_processor: string | null
          payment_proof_url: string | null
          payment_reference: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_brl: number
          amount_usd: number
          created_at?: string
          expires_at?: string
          id?: string
          installment_amount?: number | null
          installments?: number | null
          mercado_pago_payment_id?: string | null
          payment_method: string
          payment_processor?: string | null
          payment_proof_url?: string | null
          payment_reference?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_brl?: number
          amount_usd?: number
          created_at?: string
          expires_at?: string
          id?: string
          installment_amount?: number | null
          installments?: number | null
          mercado_pago_payment_id?: string | null
          payment_method?: string
          payment_processor?: string | null
          payment_proof_url?: string | null
          payment_reference?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_payouts: {
        Row: {
          amount_quai: number
          block_height: number | null
          created_at: string
          id: string
          miner_id: string | null
          shares_contributed: number
          status: string
          total_shares_in_round: number
        }
        Insert: {
          amount_quai: number
          block_height?: number | null
          created_at?: string
          id?: string
          miner_id?: string | null
          shares_contributed: number
          status?: string
          total_shares_in_round: number
        }
        Update: {
          amount_quai?: number
          block_height?: number | null
          created_at?: string
          id?: string
          miner_id?: string | null
          shares_contributed?: number
          status?: string
          total_shares_in_round?: number
        }
        Relationships: [
          {
            foreignKeyName: "pending_payouts_miner_id_fkey"
            columns: ["miner_id"]
            isOneToOne: false
            referencedRelation: "miners"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_blocks: {
        Row: {
          block_hash: string
          block_height: number
          found_at: string | null
          id: string
          miner_id: string | null
          reward_quai: number
          status: string | null
          total_shares_in_round: number | null
          worker_id: string | null
        }
        Insert: {
          block_hash: string
          block_height: number
          found_at?: string | null
          id?: string
          miner_id?: string | null
          reward_quai: number
          status?: string | null
          total_shares_in_round?: number | null
          worker_id?: string | null
        }
        Update: {
          block_hash?: string
          block_height?: number
          found_at?: string | null
          id?: string
          miner_id?: string | null
          reward_quai?: number
          status?: string | null
          total_shares_in_round?: number | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pool_blocks_miner_id_fkey"
            columns: ["miner_id"]
            isOneToOne: false
            referencedRelation: "miners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pool_blocks_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "mining_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          min_payout_quai: number
          payout_interval_hours: number
          pool_fee_percent: number
          pool_wallet_address: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          min_payout_quai?: number
          payout_interval_hours?: number
          pool_fee_percent?: number
          pool_wallet_address: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          min_payout_quai?: number
          payout_interval_hours?: number
          pool_fee_percent?: number
          pool_wallet_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      pool_earnings: {
        Row: {
          block_id: string | null
          created_at: string
          earned_at: string
          id: string
          miners_reward_quai: number
          pool_fee_quai: number
          total_reward_quai: number
        }
        Insert: {
          block_id?: string | null
          created_at?: string
          earned_at?: string
          id?: string
          miners_reward_quai: number
          pool_fee_quai: number
          total_reward_quai: number
        }
        Update: {
          block_id?: string | null
          created_at?: string
          earned_at?: string
          id?: string
          miners_reward_quai?: number
          pool_fee_quai?: number
          total_reward_quai?: number
        }
        Relationships: [
          {
            foreignKeyName: "pool_earnings_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "pool_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      pool_statistics: {
        Row: {
          active_miners: number | null
          active_workers: number | null
          blocks_found: number | null
          created_at: string | null
          date: string
          efficiency_percent: number | null
          id: string
          total_hashrate_gh: number | null
          total_shares: number | null
        }
        Insert: {
          active_miners?: number | null
          active_workers?: number | null
          blocks_found?: number | null
          created_at?: string | null
          date: string
          efficiency_percent?: number | null
          id?: string
          total_hashrate_gh?: number | null
          total_shares?: number | null
        }
        Update: {
          active_miners?: number | null
          active_workers?: number | null
          blocks_found?: number | null
          created_at?: string | null
          date?: string
          efficiency_percent?: number | null
          id?: string
          total_hashrate_gh?: number | null
          total_shares?: number | null
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          application_title: string | null
          balance: number
          created_at: string
          exchange: string | null
          id: string
          investment_type: string | null
          locked_balance: number
          price_usd: number | null
          symbol: string
          updated_at: string
          user_id: string
          value_usd: number | null
        }
        Insert: {
          application_title?: string | null
          balance?: number
          created_at?: string
          exchange?: string | null
          id?: string
          investment_type?: string | null
          locked_balance?: number
          price_usd?: number | null
          symbol: string
          updated_at?: string
          user_id: string
          value_usd?: number | null
        }
        Update: {
          application_title?: string | null
          balance?: number
          created_at?: string
          exchange?: string | null
          id?: string
          investment_type?: string | null
          locked_balance?: number
          price_usd?: number | null
          symbol?: string
          updated_at?: string
          user_id?: string
          value_usd?: number | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          blocked_until: string | null
          created_at: string
          id: string
          identifier: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          id?: string
          identifier: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          id?: string
          identifier?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      real_dex_prices: {
        Row: {
          created_at: string
          dex: string
          id: string
          liquidity: number | null
          network: string
          price: number
          price_change_24h: number | null
          spread: number | null
          symbol: string
          timestamp: string
          updated_at: string
          volume_24h: number | null
        }
        Insert: {
          created_at?: string
          dex: string
          id?: string
          liquidity?: number | null
          network: string
          price: number
          price_change_24h?: number | null
          spread?: number | null
          symbol: string
          timestamp?: string
          updated_at?: string
          volume_24h?: number | null
        }
        Update: {
          created_at?: string
          dex?: string
          id?: string
          liquidity?: number | null
          network?: string
          price?: number
          price_change_24h?: number | null
          spread?: number | null
          symbol?: string
          timestamp?: string
          updated_at?: string
          volume_24h?: number | null
        }
        Relationships: []
      }
      real_dex_prices_simulated: {
        Row: {
          created_at: string
          dex_name: string
          id: string
          is_verified: boolean | null
          liquidity_usd: number | null
          network: string
          pair_address: string | null
          pair_quote: string | null
          price_change_24h: number | null
          price_usd: number
          symbol: string
          trust_score: number | null
          updated_at: string
          volume_24h: number | null
        }
        Insert: {
          created_at?: string
          dex_name: string
          id?: string
          is_verified?: boolean | null
          liquidity_usd?: number | null
          network: string
          pair_address?: string | null
          pair_quote?: string | null
          price_change_24h?: number | null
          price_usd: number
          symbol: string
          trust_score?: number | null
          updated_at?: string
          volume_24h?: number | null
        }
        Update: {
          created_at?: string
          dex_name?: string
          id?: string
          is_verified?: boolean | null
          liquidity_usd?: number | null
          network?: string
          pair_address?: string | null
          pair_quote?: string | null
          price_change_24h?: number | null
          price_usd?: number
          symbol?: string
          trust_score?: number | null
          updated_at?: string
          volume_24h?: number | null
        }
        Relationships: []
      }
      realtime_arbitrage_opportunities: {
        Row: {
          base_currency: string
          buy_exchange: string
          buy_price: number
          created_at: string
          id: string
          is_active: boolean
          last_updated: string
          net_profit: number
          potential: number
          quote_currency: string
          risk_level: string
          sell_exchange: string
          sell_price: number
          spread: number
          symbol: string
          transfer_fee: number
          transfer_time: number
        }
        Insert: {
          base_currency: string
          buy_exchange: string
          buy_price: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_updated?: string
          net_profit: number
          potential: number
          quote_currency: string
          risk_level: string
          sell_exchange: string
          sell_price: number
          spread: number
          symbol: string
          transfer_fee?: number
          transfer_time?: number
        }
        Update: {
          base_currency?: string
          buy_exchange?: string
          buy_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_updated?: string
          net_profit?: number
          potential?: number
          quote_currency?: string
          risk_level?: string
          sell_exchange?: string
          sell_price?: number
          spread?: number
          symbol?: string
          transfer_fee?: number
          transfer_time?: number
        }
        Relationships: []
      }
      rollback_operations: {
        Row: {
          completed_at: string | null
          created_at: string
          execution_id: string
          id: string
          original_steps: Json
          recovery_amount: number | null
          rollback_steps: Json
          success: boolean
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          execution_id: string
          id?: string
          original_steps: Json
          recovery_amount?: number | null
          rollback_steps: Json
          success?: boolean
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          execution_id?: string
          id?: string
          original_steps?: Json
          recovery_amount?: number | null
          rollback_steps?: Json
          success?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rollback_operations_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automated_trade_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_executions: {
        Row: {
          created_at: string
          estimated_profit: number | null
          estimated_risk_score: number | null
          execution_plan: Json
          id: string
          sandbox_results: Json
          success: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_profit?: number | null
          estimated_risk_score?: number | null
          execution_plan: Json
          id?: string
          sandbox_results: Json
          success?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_profit?: number | null
          estimated_risk_score?: number | null
          execution_plan?: Json
          id?: string
          sandbox_results?: Json
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      scheduled_actions: {
        Row: {
          action_type: string
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          scheduled_for: string
          status: string
          symbol: string
          trade_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          scheduled_for: string
          status?: string
          symbol: string
          trade_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          scheduled_for?: string
          status?: string
          symbol?: string
          trade_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          details: Json | null
          id: string
          ip_address: unknown | null
          resolved: boolean
          resolved_at: string | null
          severity: string
          wallet_address: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          description: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resolved?: boolean
          resolved_at?: string | null
          severity: string
          wallet_address?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
          severity: string
          user_agent: string | null
          wallet_address: string | null
          worker_name: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          severity?: string
          user_agent?: string | null
          wallet_address?: string | null
          worker_name?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          severity?: string
          user_agent?: string | null
          wallet_address?: string | null
          worker_name?: string | null
        }
        Relationships: []
      }
      seo_content: {
        Row: {
          author_name: string | null
          category: string | null
          content: string
          created_at: string | null
          featured_image_url: string | null
          id: string
          keywords: string[] | null
          meta_description: string
          published_at: string | null
          read_time_minutes: number | null
          shares: number | null
          slug: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
          views: number | null
        }
        Insert: {
          author_name?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          featured_image_url?: string | null
          id?: string
          keywords?: string[] | null
          meta_description: string
          published_at?: string | null
          read_time_minutes?: number | null
          shares?: number | null
          slug: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
          views?: number | null
        }
        Update: {
          author_name?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          featured_image_url?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string
          published_at?: string | null
          read_time_minutes?: number | null
          shares?: number | null
          slug?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
          views?: number | null
        }
        Relationships: []
      }
      seo_keywords: {
        Row: {
          created_at: string | null
          current_ranking: number | null
          difficulty_score: number | null
          id: string
          keyword: string
          related_content_id: string | null
          search_volume: number | null
          target_ranking: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_ranking?: number | null
          difficulty_score?: number | null
          id?: string
          keyword: string
          related_content_id?: string | null
          search_volume?: number | null
          target_ranking?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_ranking?: number | null
          difficulty_score?: number | null
          id?: string
          keyword?: string
          related_content_id?: string | null
          search_volume?: number | null
          target_ranking?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_keywords_related_content_id_fkey"
            columns: ["related_content_id"]
            isOneToOne: false
            referencedRelation: "seo_content"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_transfer_configs: {
        Row: {
          auto_2fa: boolean
          bypass_security: boolean
          created_at: string
          from_exchange: string
          id: string
          priority: string
          required_amount: number
          symbol: string
          to_exchange: string
          updated_at: string
          use_proxy: boolean
          user_id: string
        }
        Insert: {
          auto_2fa?: boolean
          bypass_security?: boolean
          created_at?: string
          from_exchange?: string
          id?: string
          priority?: string
          required_amount?: number
          symbol?: string
          to_exchange?: string
          updated_at?: string
          use_proxy?: boolean
          user_id: string
        }
        Update: {
          auto_2fa?: boolean
          bypass_security?: boolean
          created_at?: string
          from_exchange?: string
          id?: string
          priority?: string
          required_amount?: number
          symbol?: string
          to_exchange?: string
          updated_at?: string
          use_proxy?: boolean
          user_id?: string
        }
        Relationships: []
      }
      social_media_posts: {
        Row: {
          campaign_id: string | null
          content: string
          created_at: string | null
          engagement_metrics: Json | null
          hashtags: string[] | null
          id: string
          image_url: string | null
          link_url: string | null
          platform: string
          posted_at: string | null
          scheduled_for: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          campaign_id?: string | null
          content: string
          created_at?: string | null
          engagement_metrics?: Json | null
          hashtags?: string[] | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          platform: string
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          campaign_id?: string | null
          content?: string
          created_at?: string | null
          engagement_metrics?: Json | null
          hashtags?: string[] | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          platform?: string
          posted_at?: string | null
          scheduled_for?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      solana_arbitrage_opportunities: {
        Row: {
          buy_dex: string
          buy_pool_address: string | null
          buy_price: number
          created_at: string
          data_source: string
          execution_time_estimate: number | null
          expires_at: string | null
          gas_fee_estimate: number | null
          id: string
          is_active: boolean
          liquidity_buy: number | null
          liquidity_sell: number | null
          mev_risk_score: number | null
          net_profit_usd: number
          risk_level: string
          roi_percentage: number
          sell_dex: string
          sell_pool_address: string | null
          sell_price: number
          spread_percentage: number
          symbol: string
          updated_at: string
        }
        Insert: {
          buy_dex: string
          buy_pool_address?: string | null
          buy_price: number
          created_at?: string
          data_source?: string
          execution_time_estimate?: number | null
          expires_at?: string | null
          gas_fee_estimate?: number | null
          id?: string
          is_active?: boolean
          liquidity_buy?: number | null
          liquidity_sell?: number | null
          mev_risk_score?: number | null
          net_profit_usd: number
          risk_level?: string
          roi_percentage: number
          sell_dex: string
          sell_pool_address?: string | null
          sell_price: number
          spread_percentage: number
          symbol: string
          updated_at?: string
        }
        Update: {
          buy_dex?: string
          buy_pool_address?: string | null
          buy_price?: number
          created_at?: string
          data_source?: string
          execution_time_estimate?: number | null
          expires_at?: string | null
          gas_fee_estimate?: number | null
          id?: string
          is_active?: boolean
          liquidity_buy?: number | null
          liquidity_sell?: number | null
          mev_risk_score?: number | null
          net_profit_usd?: number
          risk_level?: string
          roi_percentage?: number
          sell_dex?: string
          sell_pool_address?: string | null
          sell_price?: number
          spread_percentage?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      solana_dex_prices: {
        Row: {
          created_at: string
          dex_name: string
          id: string
          is_verified: boolean | null
          liquidity_usd: number | null
          pool_address: string | null
          price_change_24h: number | null
          price_usd: number
          quote_mint: string | null
          symbol: string
          token_mint: string | null
          trust_score: number | null
          updated_at: string
          volume_24h: number | null
        }
        Insert: {
          created_at?: string
          dex_name: string
          id?: string
          is_verified?: boolean | null
          liquidity_usd?: number | null
          pool_address?: string | null
          price_change_24h?: number | null
          price_usd: number
          quote_mint?: string | null
          symbol: string
          token_mint?: string | null
          trust_score?: number | null
          updated_at?: string
          volume_24h?: number | null
        }
        Update: {
          created_at?: string
          dex_name?: string
          id?: string
          is_verified?: boolean | null
          liquidity_usd?: number | null
          pool_address?: string | null
          price_change_24h?: number | null
          price_usd?: number
          quote_mint?: string | null
          symbol?: string
          token_mint?: string | null
          trust_score?: number | null
          updated_at?: string
          volume_24h?: number | null
        }
        Relationships: []
      }
      solana_mev_settings: {
        Row: {
          anti_sandwich_protection: boolean | null
          created_at: string
          fragmented_orders: boolean | null
          id: string
          max_mev_tip: number | null
          max_order_fragments: number | null
          priority_fee_multiplier: number | null
          timing_randomization: boolean | null
          updated_at: string
          use_jito_bundles: boolean | null
          use_private_mempool: boolean | null
          user_id: string
        }
        Insert: {
          anti_sandwich_protection?: boolean | null
          created_at?: string
          fragmented_orders?: boolean | null
          id?: string
          max_mev_tip?: number | null
          max_order_fragments?: number | null
          priority_fee_multiplier?: number | null
          timing_randomization?: boolean | null
          updated_at?: string
          use_jito_bundles?: boolean | null
          use_private_mempool?: boolean | null
          user_id: string
        }
        Update: {
          anti_sandwich_protection?: boolean | null
          created_at?: string
          fragmented_orders?: boolean | null
          id?: string
          max_mev_tip?: number | null
          max_order_fragments?: number | null
          priority_fee_multiplier?: number | null
          timing_randomization?: boolean | null
          updated_at?: string
          use_jito_bundles?: boolean | null
          use_private_mempool?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      solana_trade_executions: {
        Row: {
          actual_profit: number | null
          amount_sol: number
          buy_dex: string
          buy_tx_signature: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          expected_profit: number
          gas_fees_paid: number | null
          id: string
          mev_protection_used: boolean | null
          opportunity_id: string | null
          sell_dex: string
          sell_tx_signature: string | null
          started_at: string
          status: string
          symbol: string
          user_id: string
        }
        Insert: {
          actual_profit?: number | null
          amount_sol: number
          buy_dex: string
          buy_tx_signature?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          expected_profit: number
          gas_fees_paid?: number | null
          id?: string
          mev_protection_used?: boolean | null
          opportunity_id?: string | null
          sell_dex: string
          sell_tx_signature?: string | null
          started_at?: string
          status?: string
          symbol: string
          user_id: string
        }
        Update: {
          actual_profit?: number | null
          amount_sol?: number
          buy_dex?: string
          buy_tx_signature?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          expected_profit?: number
          gas_fees_paid?: number | null
          id?: string
          mev_protection_used?: boolean | null
          opportunity_id?: string | null
          sell_dex?: string
          sell_tx_signature?: string | null
          started_at?: string
          status?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      solana_user_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_slippage: number | null
          min_liquidity_usd: number | null
          mint_address: string | null
          name: string
          priority: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_slippage?: number | null
          min_liquidity_usd?: number | null
          mint_address?: string | null
          name: string
          priority?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_slippage?: number | null
          min_liquidity_usd?: number | null
          mint_address?: string | null
          name?: string
          priority?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      solana_wallet_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_slippage: number | null
          mev_protection_enabled: boolean | null
          priority_fee_strategy: string | null
          rpc_endpoint: string | null
          updated_at: string
          user_id: string
          wallet_address: string
          wallet_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_slippage?: number | null
          mev_protection_enabled?: boolean | null
          priority_fee_strategy?: string | null
          rpc_endpoint?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
          wallet_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_slippage?: number | null
          mev_protection_enabled?: boolean | null
          priority_fee_strategy?: string | null
          rpc_endpoint?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
          wallet_type?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          duration_days: number | null
          features: string[]
          has_ai_predictions: boolean | null
          has_api_access: boolean | null
          has_arbitrage_bot: boolean | null
          id: string
          max_exchanges: number | null
          name: string
          price_brl: number
          price_usd: number
          support_level: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          features: string[]
          has_ai_predictions?: boolean | null
          has_api_access?: boolean | null
          has_arbitrage_bot?: boolean | null
          id?: string
          max_exchanges?: number | null
          name: string
          price_brl: number
          price_usd: number
          support_level?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          features?: string[]
          has_ai_predictions?: boolean | null
          has_api_access?: boolean | null
          has_arbitrage_bot?: boolean | null
          id?: string
          max_exchanges?: number | null
          name?: string
          price_brl?: number
          price_usd?: number
          support_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans_new: {
        Row: {
          created_at: string
          currency: string | null
          duration_days: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          mercado_pago_link_1x: string | null
          mercado_pago_link_2x: string | null
          mercado_pago_link_3x: string | null
          mercado_pago_link_4x: string | null
          mercado_pago_link_5x: string | null
          mercado_pago_link_6x: string | null
          mercado_pago_link_pix: string | null
          name: string
          price: number
          price_locked: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          duration_days?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          mercado_pago_link_1x?: string | null
          mercado_pago_link_2x?: string | null
          mercado_pago_link_3x?: string | null
          mercado_pago_link_4x?: string | null
          mercado_pago_link_5x?: string | null
          mercado_pago_link_6x?: string | null
          mercado_pago_link_pix?: string | null
          name: string
          price: number
          price_locked?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          duration_days?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          mercado_pago_link_1x?: string | null
          mercado_pago_link_2x?: string | null
          mercado_pago_link_3x?: string | null
          mercado_pago_link_4x?: string | null
          mercado_pago_link_5x?: string | null
          mercado_pago_link_6x?: string | null
          mercado_pago_link_pix?: string | null
          name?: string
          price?: number
          price_locked?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      synchronized_prices: {
        Row: {
          confidence_score: number
          created_at: string
          exchange_count: number
          id: string
          max_latency: number
          normalized_price: number
          price_variance: number
          raw_prices: Json
          symbol: string
          synchronized_at: string
          updated_at: string
        }
        Insert: {
          confidence_score: number
          created_at?: string
          exchange_count: number
          id?: string
          max_latency: number
          normalized_price: number
          price_variance: number
          raw_prices?: Json
          symbol: string
          synchronized_at?: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          exchange_count?: number
          id?: string
          max_latency?: number
          normalized_price?: number
          price_variance?: number
          raw_prices?: Json
          symbol?: string
          synchronized_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      tcc_monthly_analysis: {
        Row: {
          analysis_month: string
          avg_btc_price: number | null
          avg_execution_time_seconds: number
          avg_spread_percentage: number
          bridge_fees_total: number | null
          created_at: string
          exchanges_used: Json | null
          failed_operations: number
          gas_fees_total: number | null
          gross_profit: number
          high_risk_operations: number
          id: string
          initial_capital: number
          low_risk_operations: number
          market_sentiment_distribution: Json | null
          market_volatility_periods: Json | null
          max_execution_time_seconds: number
          medium_risk_operations: number
          min_execution_time_seconds: number
          net_profit: number
          operation_type: string
          opportunity_conversion_rate: number | null
          roi_percentage: number
          sample_group: number
          slippage_impact: number | null
          success_rate: number
          successful_operations: number
          tokens_analyzed: Json | null
          total_fees: number
          total_investment: number
          total_operations: number
          updated_at: string
        }
        Insert: {
          analysis_month: string
          avg_btc_price?: number | null
          avg_execution_time_seconds?: number
          avg_spread_percentage?: number
          bridge_fees_total?: number | null
          created_at?: string
          exchanges_used?: Json | null
          failed_operations?: number
          gas_fees_total?: number | null
          gross_profit?: number
          high_risk_operations?: number
          id?: string
          initial_capital: number
          low_risk_operations?: number
          market_sentiment_distribution?: Json | null
          market_volatility_periods?: Json | null
          max_execution_time_seconds?: number
          medium_risk_operations?: number
          min_execution_time_seconds?: number
          net_profit?: number
          operation_type: string
          opportunity_conversion_rate?: number | null
          roi_percentage?: number
          sample_group: number
          slippage_impact?: number | null
          success_rate?: number
          successful_operations?: number
          tokens_analyzed?: Json | null
          total_fees?: number
          total_investment?: number
          total_operations?: number
          updated_at?: string
        }
        Update: {
          analysis_month?: string
          avg_btc_price?: number | null
          avg_execution_time_seconds?: number
          avg_spread_percentage?: number
          bridge_fees_total?: number | null
          created_at?: string
          exchanges_used?: Json | null
          failed_operations?: number
          gas_fees_total?: number | null
          gross_profit?: number
          high_risk_operations?: number
          id?: string
          initial_capital?: number
          low_risk_operations?: number
          market_sentiment_distribution?: Json | null
          market_volatility_periods?: Json | null
          max_execution_time_seconds?: number
          medium_risk_operations?: number
          min_execution_time_seconds?: number
          net_profit?: number
          operation_type?: string
          opportunity_conversion_rate?: number | null
          roi_percentage?: number
          sample_group?: number
          slippage_impact?: number | null
          success_rate?: number
          successful_operations?: number
          tokens_analyzed?: Json | null
          total_fees?: number
          total_investment?: number
          total_operations?: number
          updated_at?: string
        }
        Relationships: []
      }
      tcc_sample_operations: {
        Row: {
          created_at: string | null
          detailed_description: string
          exchanges_involved: Json
          execution_steps: Json
          final_result: Json
          id: string
          initial_investment: number
          market_conditions: Json
          operation_date: string
          operation_type: string
          risk_assessment: string
          sample_group: number
          success_status: string
          tokens_involved: Json
        }
        Insert: {
          created_at?: string | null
          detailed_description: string
          exchanges_involved?: Json
          execution_steps?: Json
          final_result?: Json
          id?: string
          initial_investment: number
          market_conditions?: Json
          operation_date: string
          operation_type: string
          risk_assessment: string
          sample_group: number
          success_status: string
          tokens_involved?: Json
        }
        Update: {
          created_at?: string | null
          detailed_description?: string
          exchanges_involved?: Json
          execution_steps?: Json
          final_result?: Json
          id?: string
          initial_investment?: number
          market_conditions?: Json
          operation_date?: string
          operation_type?: string
          risk_assessment?: string
          sample_group?: number
          success_status?: string
          tokens_involved?: Json
        }
        Relationships: []
      }
      triangular_arbitrage_executions: {
        Row: {
          actual_profit: number | null
          actual_spread: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          execution_steps: Json | null
          execution_time_ms: number | null
          flashloan_data: Json | null
          gas_used: number | null
          id: string
          investment_amount: number
          opportunity_id: string | null
          status: string | null
          transaction_hashes: Json | null
          user_id: string | null
        }
        Insert: {
          actual_profit?: number | null
          actual_spread?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_steps?: Json | null
          execution_time_ms?: number | null
          flashloan_data?: Json | null
          gas_used?: number | null
          id?: string
          investment_amount: number
          opportunity_id?: string | null
          status?: string | null
          transaction_hashes?: Json | null
          user_id?: string | null
        }
        Update: {
          actual_profit?: number | null
          actual_spread?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          execution_steps?: Json | null
          execution_time_ms?: number | null
          flashloan_data?: Json | null
          gas_used?: number | null
          id?: string
          investment_amount?: number
          opportunity_id?: string | null
          status?: string | null
          transaction_hashes?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "triangular_arbitrage_executions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "triangular_arbitrage_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      triangular_arbitrage_opportunities: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          estimated_profit: number
          executed_at: string | null
          expires_at: string | null
          flashloan_required: boolean | null
          gas_estimate: number | null
          id: string
          is_executable: boolean | null
          liquidity_data: Json | null
          net_profit: number
          path: string
          risk_level: string
          roi_percent: number
          spread_percent: number
          status: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          estimated_profit: number
          executed_at?: string | null
          expires_at?: string | null
          flashloan_required?: boolean | null
          gas_estimate?: number | null
          id?: string
          is_executable?: boolean | null
          liquidity_data?: Json | null
          net_profit: number
          path: string
          risk_level: string
          roi_percent: number
          spread_percent: number
          status?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          estimated_profit?: number
          executed_at?: string | null
          expires_at?: string | null
          flashloan_required?: boolean | null
          gas_estimate?: number | null
          id?: string
          is_executable?: boolean | null
          liquidity_data?: Json | null
          net_profit?: number
          path?: string
          risk_level?: string
          roi_percent?: number
          spread_percent?: number
          status?: string | null
        }
        Relationships: []
      }
      user_access_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          github_username: string | null
          id: string
          lovable_username: string | null
          request_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          github_username?: string | null
          id?: string
          lovable_username?: string | null
          request_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          github_username?: string | null
          id?: string
          lovable_username?: string | null
          request_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_credentials: {
        Row: {
          binance_api_key: string | null
          binance_secret_key: string | null
          created_at: string
          id: string
          pionex_api_key: string | null
          pionex_secret_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          binance_api_key?: string | null
          binance_secret_key?: string | null
          created_at?: string
          id?: string
          pionex_api_key?: string | null
          pionex_secret_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          binance_api_key?: string | null
          binance_secret_key?: string | null
          created_at?: string
          id?: string
          pionex_api_key?: string | null
          pionex_secret_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_arbitrage_selections: {
        Row: {
          auto_execute: boolean
          buy_dex: string
          buy_price: number
          created_at: string
          expected_profit: number
          id: string
          is_active: boolean
          max_trade_amount: number
          min_spread_threshold: number
          sell_dex: string
          sell_price: number
          spread_percentage: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_execute?: boolean
          buy_dex: string
          buy_price: number
          created_at?: string
          expected_profit: number
          id?: string
          is_active?: boolean
          max_trade_amount?: number
          min_spread_threshold?: number
          sell_dex: string
          sell_price: number
          spread_percentage: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_execute?: boolean
          buy_dex?: string
          buy_price?: number
          created_at?: string
          expected_profit?: number
          id?: string
          is_active?: boolean
          max_trade_amount?: number
          min_spread_threshold?: number
          sell_dex?: string
          sell_price?: number
          spread_percentage?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_comments: {
        Row: {
          admin_response: string | null
          approved_at: string | null
          approved_by: string | null
          comment_text: string
          created_at: string
          id: string
          rejected_at: string | null
          status: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          admin_response?: string | null
          approved_at?: string | null
          approved_by?: string | null
          comment_text: string
          created_at?: string
          id?: string
          rejected_at?: string | null
          status?: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          admin_response?: string | null
          approved_at?: string | null
          approved_by?: string | null
          comment_text?: string
          created_at?: string
          id?: string
          rejected_at?: string | null
          status?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      user_passwords: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          password_code: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          password_code: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          password_code?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string
          ends_at: string
          id: string
          payment_id: string | null
          plan_id: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string
          ends_at: string
          id?: string
          payment_id?: string | null
          plan_id: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string
          ends_at?: string
          id?: string
          payment_id?: string | null
          plan_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trading_limits: {
        Row: {
          created_at: string
          daily_limit: number
          id: string
          is_active: boolean
          max_concurrent_trades: number
          max_trade_size: number
          monthly_limit: number
          updated_at: string
          user_id: string
          weekly_limit: number
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          id?: string
          is_active?: boolean
          max_concurrent_trades?: number
          max_trade_size?: number
          monthly_limit?: number
          updated_at?: string
          user_id: string
          weekly_limit?: number
        }
        Update: {
          created_at?: string
          daily_limit?: number
          id?: string
          is_active?: boolean
          max_concurrent_trades?: number
          max_trade_size?: number
          monthly_limit?: number
          updated_at?: string
          user_id?: string
          weekly_limit?: number
        }
        Relationships: []
      }
      user_trials: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          plan_type: string
          started_at: string
          trial_duration_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          plan_type?: string
          started_at?: string
          trial_duration_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          plan_type?: string
          started_at?: string
          trial_duration_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_balances: {
        Row: {
          available_balance: number
          balance: number
          created_at: string
          exchange: string
          id: string
          locked_balance: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          balance?: number
          created_at?: string
          exchange: string
          id?: string
          locked_balance?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          balance?: number
          created_at?: string
          exchange?: string
          id?: string
          locked_balance?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_rebalance_operations: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          deposit_tx_id: string | null
          error_message: string | null
          from_exchange: string
          id: string
          mode: string
          priority: string
          reason: string | null
          started_at: string | null
          status: string
          symbol: string
          to_exchange: string
          updated_at: string
          user_id: string
          withdrawal_tx_id: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          deposit_tx_id?: string | null
          error_message?: string | null
          from_exchange: string
          id?: string
          mode?: string
          priority?: string
          reason?: string | null
          started_at?: string | null
          status?: string
          symbol: string
          to_exchange: string
          updated_at?: string
          user_id: string
          withdrawal_tx_id?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          deposit_tx_id?: string | null
          error_message?: string | null
          from_exchange?: string
          id?: string
          mode?: string
          priority?: string
          reason?: string | null
          started_at?: string | null
          status?: string
          symbol?: string
          to_exchange?: string
          updated_at?: string
          user_id?: string
          withdrawal_tx_id?: string | null
        }
        Relationships: []
      }
      youtube_content: {
        Row: {
          category: string | null
          comments: number | null
          created_at: string | null
          description: string
          duration_minutes: number | null
          id: string
          keywords: string[] | null
          likes: number | null
          published_at: string | null
          script: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
          video_url: string | null
          views: number | null
        }
        Insert: {
          category?: string | null
          comments?: number | null
          created_at?: string | null
          description: string
          duration_minutes?: number | null
          id?: string
          keywords?: string[] | null
          likes?: number | null
          published_at?: string | null
          script?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          video_url?: string | null
          views?: number | null
        }
        Update: {
          category?: string | null
          comments?: number | null
          created_at?: string | null
          description?: string
          duration_minutes?: number | null
          id?: string
          keywords?: string[] | null
          likes?: number | null
          published_at?: string | null
          script?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
          views?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_subscription_end_date: {
        Args: { plan_name: string; start_date?: string }
        Returns: string
      }
      check_and_lock_balance_for_arbitrage: {
        Args: {
          p_amount: number
          p_buy_exchange: string
          p_current_price?: number
          p_sell_exchange: string
          p_symbol: string
          p_user_id: string
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_opportunities: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_triangular_opportunities: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      deactivate_expired_trial_users: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      generate_fresh_arbitrage_opportunities: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_unique_password: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_demo_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_exchange_symbol_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          exchange: string
          last_updated: string
          symbol_count: number
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_active_access: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_saat_lite_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_triangular_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_trial_active: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_ip_address?: unknown
          p_severity?: string
          p_user_agent?: string
          p_wallet_address?: string
          p_worker_name?: string
        }
        Returns: string
      }
      process_automatic_payouts: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      process_block_rewards: {
        Args: { block_id: string }
        Returns: undefined
      }
      unlock_balance_after_arbitrage: {
        Args: {
          p_amount: number
          p_buy_exchange: string
          p_current_price?: number
          p_sell_exchange: string
          p_success?: boolean
          p_symbol: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_miner_stats: {
        Args: {
          p_hashrate?: number
          p_miner_id: string
          p_shares_accepted?: number
          p_shares_submitted?: number
        }
        Returns: undefined
      }
      update_pool_statistics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_portfolio_balance: {
        Args: { p_amount_change: number; p_symbol: string; p_user_id: string }
        Returns: undefined
      }
      validate_access_code: {
        Args: { input_code: string }
        Returns: boolean
      }
      validate_mining_share: {
        Args: {
          p_difficulty: number
          p_ip_address?: unknown
          p_share_hash: string
          p_wallet_address: string
          p_worker_name: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "avancado"
        | "basico"
        | "user"
        | "triangular_pro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "avancado",
        "basico",
        "user",
        "triangular_pro",
      ],
    },
  },
} as const
