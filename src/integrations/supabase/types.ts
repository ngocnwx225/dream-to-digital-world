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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string | null
          plate: string | null
          updated_at: string
          vehicle_name: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          plate?: string | null
          updated_at?: string
          vehicle_name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          plate?: string | null
          updated_at?: string
          vehicle_name?: string | null
        }
        Relationships: []
      }
      inventory_balances: {
        Row: {
          avg_cost: number
          created_at: string
          opening_qty: number
          product_id: string
          quantity: number
          total_in: number
          total_out: number
          updated_at: string
          value: number
        }
        Insert: {
          avg_cost?: number
          created_at?: string
          opening_qty?: number
          product_id: string
          quantity?: number
          total_in?: number
          total_out?: number
          updated_at?: string
          value?: number
        }
        Update: {
          avg_cost?: number
          created_at?: string
          opening_qty?: number
          product_id?: string
          quantity?: number
          total_in?: number
          total_out?: number
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          avg_cost_after: number
          created_at: string
          doc_code: string | null
          id: string
          movement_date: string
          movement_type: string
          product_id: string
          qty_after: number
          qty_change: number
          ref_id: string | null
          seq: number
          unit_cost: number | null
          value_after: number
        }
        Insert: {
          avg_cost_after: number
          created_at?: string
          doc_code?: string | null
          id?: string
          movement_date: string
          movement_type: string
          product_id: string
          qty_after: number
          qty_change: number
          ref_id?: string | null
          seq: number
          unit_cost?: number | null
          value_after: number
        }
        Update: {
          avg_cost_after?: number
          created_at?: string
          doc_code?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          product_id?: string
          qty_after?: number
          qty_change?: number
          ref_id?: string | null
          seq?: number
          unit_cost?: number | null
          value_after?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_opening_balances: {
        Row: {
          amount: number
          created_at: string
          id: string
          opening_date: string
          product_id: string
          quantity: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          opening_date?: string
          product_id: string
          quantity: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          opening_date?: string
          product_id?: string
          quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_opening_balances_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          low_stock_threshold: number | null
          name: string
          note: string | null
          sale_price: number
          unit: string
          updated_at: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number | null
          name: string
          note?: string | null
          sale_price: number
          unit?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          low_stock_threshold?: number | null
          name?: string
          note?: string | null
          sale_price?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          receipt_id: string
          unit_cost: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          receipt_id: string
          unit_cost: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          receipt_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          cancel_reason: string | null
          code: string
          created_at: string
          id: string
          note: string | null
          receipt_date: string
          status: Database["public"]["Enums"]["doc_status"]
          total_amount: number
          total_qty: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          code?: string
          created_at?: string
          id?: string
          note?: string | null
          receipt_date?: string
          status?: Database["public"]["Enums"]["doc_status"]
          total_amount?: number
          total_qty?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          code?: string
          created_at?: string
          id?: string
          note?: string | null
          receipt_date?: string
          status?: Database["public"]["Enums"]["doc_status"]
          total_amount?: number
          total_qty?: number
          updated_at?: string
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          amount: number
          cost_amount: number
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          amount: number
          cost_amount?: number
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_cost?: number
          unit_price: number
        }
        Update: {
          amount?: number
          cost_amount?: number
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          cancel_reason: string | null
          code: string
          consumable_total_cost: number
          consumable_unit_cost: number | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          note: string | null
          order_date: string
          phone: string | null
          plate: string | null
          status: Database["public"]["Enums"]["doc_status"]
          total_amount: number
          total_cost: number
          total_qty: number
          updated_at: string
          vehicle_count: number | null
          vehicle_name: string | null
        }
        Insert: {
          cancel_reason?: string | null
          code?: string
          consumable_total_cost?: number
          consumable_unit_cost?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          note?: string | null
          order_date?: string
          phone?: string | null
          plate?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          total_amount?: number
          total_cost?: number
          total_qty?: number
          updated_at?: string
          vehicle_count?: number | null
          vehicle_name?: string | null
        }
        Update: {
          cancel_reason?: string | null
          code?: string
          consumable_total_cost?: number
          consumable_unit_cost?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          note?: string | null
          order_date?: string
          phone?: string | null
          plate?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          total_amount?: number
          total_cost?: number
          total_qty?: number
          updated_at?: string
          vehicle_count?: number | null
          vehicle_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          consumable_cost_per_vehicle: number
          created_at: string
          default_low_stock: number
          id: number
          store_name: string
          updated_at: string
        }
        Insert: {
          consumable_cost_per_vehicle?: number
          created_at?: string
          default_low_stock?: number
          id?: number
          store_name?: string
          updated_at?: string
        }
        Update: {
          consumable_cost_per_vehicle?: number
          created_at?: string
          default_low_stock?: number
          id?: number
          store_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_purchase: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      cancel_sale: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      ensure_owner: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      owner_exists: { Args: never; Returns: boolean }
      recalc_product: { Args: { p_product: string }; Returns: undefined }
      refresh_sales_totals: { Args: never; Returns: undefined }
      save_opening_balance: {
        Args: {
          p_amount: number
          p_date: string
          p_product: string
          p_qty: number
          p_replace: boolean
        }
        Returns: undefined
      }
      save_purchase: {
        Args: { p_date: string; p_id: string; p_items: Json; p_note: string }
        Returns: string
      }
      save_sale: {
        Args: {
          p_customer: Json
          p_customer_id: string
          p_date: string
          p_id: string
          p_items: Json
          p_note: string
          p_save_customer: boolean
          p_vehicle_count?: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin"
      doc_status: "completed" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
      doc_status: ["completed", "cancelled"],
    },
  },
} as const
