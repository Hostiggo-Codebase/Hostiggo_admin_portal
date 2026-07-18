export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_shifts: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          shift_date: string
          shift_end: string
          shift_start: string
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          shift_date: string
          shift_end: string
          shift_start: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          shift_date?: string
          shift_end?: string
          shift_start?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_shifts_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["admin_id"]
          },
          {
            foreignKeyName: "admin_shifts_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "analytics_agent_load"
            referencedColumns: ["admin_id"]
          },
        ]
      }
      admin_users: {
        Row: {
          accepting_new_chats: boolean
          active_chat_count: number
          admin_id: string
          agent_status: string
          created_at: string
          display_name: string
          last_action_at: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          accepting_new_chats?: boolean
          active_chat_count?: number
          admin_id: string
          agent_status?: string
          created_at?: string
          display_name: string
          last_action_at?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          accepting_new_chats?: boolean
          active_chat_count?: number
          admin_id?: string
          agent_status?: string
          created_at?: string
          display_name?: string
          last_action_at?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          ticket_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          ticket_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["admin_id"]
          },
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "analytics_agent_load"
            referencedColumns: ["admin_id"]
          },
          {
            foreignKeyName: "audit_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_internal_note: boolean
          read_at: string | null
          sender_id: string
          sender_type: string
          ticket_id: string
          updated_at: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          read_at?: string | null
          sender_id: string
          sender_type: string
          ticket_id: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          read_at?: string | null
          sender_id?: string
          sender_type?: string
          ticket_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
      complaint_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          payload: Json
          ticket_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          ticket_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          payload?: Json
          ticket_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
      sla_targets: {
        Row: {
          first_response_ms: number
          priority_label: string
          resolution_ms: number
        }
        Insert: {
          first_response_ms: number
          priority_label: string
          resolution_ms: number
        }
        Update: {
          first_response_ms?: number
          priority_label?: string
          resolution_ms?: number
        }
        Relationships: []
      }
      status_transitions: {
        Row: {
          from_status: string | null
          to_status: string
        }
        Insert: {
          from_status?: string | null
          to_status: string
        }
        Update: {
          from_status?: string | null
          to_status?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_agent_id: string | null
          assigned_at: string | null
          booking_id: string | null
          callback_phone: string | null
          callback_slot: string | null
          category_id: string
          closed_at: string | null
          created_at: string
          deferred_type: string | null
          description: string
          disconnect_grace_expires_at: string | null
          escalated_at: string | null
          escalated_by: string | null
          first_response_at: string | null
          last_user_activity: string | null
          parent_ticket_id: string | null
          priority: number
          priority_label: string
          property_id: string | null
          queued_at: string
          rating: number | null
          rating_comment: string | null
          reopen_window_expires_at: string | null
          resolved_at: string | null
          status: string
          subject: string
          ticket_id: string
          ticket_number: string | null
          transfer_count: number
          transferred_from: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_at?: string | null
          booking_id?: string | null
          callback_phone?: string | null
          callback_slot?: string | null
          category_id: string
          closed_at?: string | null
          created_at?: string
          deferred_type?: string | null
          description: string
          disconnect_grace_expires_at?: string | null
          escalated_at?: string | null
          escalated_by?: string | null
          first_response_at?: string | null
          last_user_activity?: string | null
          parent_ticket_id?: string | null
          priority?: number
          priority_label: string
          property_id?: string | null
          queued_at?: string
          rating?: number | null
          rating_comment?: string | null
          reopen_window_expires_at?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          ticket_id?: string
          ticket_number?: string | null
          transfer_count?: number
          transferred_from?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_at?: string | null
          booking_id?: string | null
          callback_phone?: string | null
          callback_slot?: string | null
          category_id?: string
          closed_at?: string | null
          created_at?: string
          deferred_type?: string | null
          description?: string
          disconnect_grace_expires_at?: string | null
          escalated_at?: string | null
          escalated_by?: string | null
          first_response_at?: string | null
          last_user_activity?: string | null
          parent_ticket_id?: string | null
          priority?: number
          priority_label?: string
          property_id?: string | null
          queued_at?: string
          rating?: number | null
          rating_comment?: string | null
          reopen_window_expires_at?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          ticket_id?: string
          ticket_number?: string | null
          transfer_count?: number
          transferred_from?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["admin_id"]
          },
          {
            foreignKeyName: "support_tickets_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "analytics_agent_load"
            referencedColumns: ["admin_id"]
          },
          {
            foreignKeyName: "support_tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "complaint_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "support_tickets_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["admin_id"]
          },
          {
            foreignKeyName: "support_tickets_transferred_from_fkey"
            columns: ["transferred_from"]
            isOneToOne: false
            referencedRelation: "analytics_agent_load"
            referencedColumns: ["admin_id"]
          },
        ]
      }
      system_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      ticket_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          ticket_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          ticket_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          ticket_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["ticket_id"]
          },
        ]
      }
    }
    Views: {
      analytics_agent_load: {
        Row: {
          accepting_new_chats: boolean | null
          active_chat_count: number | null
          admin_id: string | null
          agent_status: string | null
          display_name: string | null
          total_assigned: number | null
        }
        Relationships: []
      }
      analytics_csat: {
        Row: {
          avg_rating: number | null
          five_star: number | null
          four_plus: number | null
          rated_count: number | null
        }
        Relationships: []
      }
      analytics_resolution_time: {
        Row: {
          avg_resolution_minutes: number | null
          priority_label: string | null
          ticket_count: number | null
        }
        Relationships: []
      }
      analytics_sla_breach: {
        Row: {
          breached: number | null
          priority_label: string | null
          total: number | null
          within_sla: number | null
        }
        Relationships: []
      }
      analytics_tickets_by_category: {
        Row: {
          category: string | null
          closed_count: number | null
          resolved_count: number | null
          ticket_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_next_ticket: { Args: never; Returns: string }
      change_status: {
        Args: { p_new_status: string; p_note?: string; p_ticket_id: string }
        Returns: undefined
      }
      create_ticket: {
        Args: {
          p_booking_id?: string
          p_callback_phone?: string
          p_callback_slot?: string
          p_category_id: string
          p_deferred_type?: string
          p_description: string
          p_priority_label: string
          p_property_id?: string
          p_subject: string
        }
        Returns: Json
      }
      cron_auto_close_expired: { Args: never; Returns: undefined }
      cron_callback_due: { Args: never; Returns: undefined }
      cron_disconnect_grace: { Args: never; Returns: undefined }
      cron_inactivity_sweep: { Args: never; Returns: undefined }
      cron_requeue_deferred: { Args: never; Returns: undefined }
      cron_shift_end_warning: { Args: never; Returns: undefined }
      escalate_ticket: {
        Args: { p_reason: string; p_ticket_id: string }
        Returns: undefined
      }
      heartbeat: { Args: never; Returns: undefined }
      rate_ticket: {
        Args: { p_comment?: string; p_rating: number; p_ticket_id: string }
        Returns: undefined
      }
      release_agent_slot: { Args: { p_agent_id: string }; Returns: undefined }
      reopen_ticket: {
        Args: { p_reason: string; p_ticket_id: string }
        Returns: undefined
      }
      resolve_escalation: {
        Args: { p_decision: string; p_note?: string; p_ticket_id: string }
        Returns: undefined
      }
      send_message: {
        Args: {
          p_body: string
          p_is_internal_note?: boolean
          p_ticket_id: string
        }
        Returns: string
      }
      set_agent_presence: {
        Args: { p_accepting: boolean; p_status: string }
        Returns: undefined
      }
      set_disconnect_grace: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      transfer_ticket: {
        Args: { p_ticket_id: string; p_to_agent: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

