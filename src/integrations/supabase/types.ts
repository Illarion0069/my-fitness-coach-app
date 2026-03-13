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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      body_measurements: {
        Row: {
          chest_cm: number | null
          created_at: string
          hips_cm: number | null
          id: string
          left_arm_cm: number | null
          left_leg_cm: number | null
          measured_at: string
          notes: string | null
          right_arm_cm: number | null
          right_leg_cm: number | null
          trainer_user_id: string
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_leg_cm?: number | null
          measured_at?: string
          notes?: string | null
          right_arm_cm?: number | null
          right_leg_cm?: number | null
          trainer_user_id: string
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_leg_cm?: number | null
          measured_at?: string
          notes?: string | null
          right_arm_cm?: number | null
          right_leg_cm?: number | null
          trainer_user_id?: string
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      client_packages: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          package_name: string
          price_paid: number | null
          purchased_at: string
          total_sessions: number
          updated_at: string
          used_sessions: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          package_name: string
          price_paid?: number | null
          purchased_at?: string
          total_sessions: number
          updated_at?: string
          used_sessions?: number
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          package_name?: string
          price_paid?: number | null
          purchased_at?: string
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
          user_id?: string
        }
        Relationships: []
      }
      client_progress_photos: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          photo_type: string
          photo_url: string
          taken_at: string
          trainer_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          photo_type: string
          photo_url: string
          taken_at?: string
          trainer_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          photo_type?: string
          photo_url?: string
          taken_at?: string
          trainer_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_photos: {
        Row: {
          created_at: string
          id: string
          log_date: string
          meal_note: string | null
          meal_type: string
          photo_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          meal_note?: string | null
          meal_type?: string
          photo_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          meal_note?: string | null
          meal_type?: string
          photo_url?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          ai_analysis: Json | null
          ai_feedback: string | null
          ai_score: number | null
          alcohol_ml: number
          coffee_cups: number
          created_at: string
          id: string
          log_date: string
          notes: string | null
          tea_cups: number
          updated_at: string
          user_id: string
          water_ml: number
        }
        Insert: {
          ai_analysis?: Json | null
          ai_feedback?: string | null
          ai_score?: number | null
          alcohol_ml?: number
          coffee_cups?: number
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          tea_cups?: number
          updated_at?: string
          user_id: string
          water_ml?: number
        }
        Update: {
          ai_analysis?: Json | null
          ai_feedback?: string | null
          ai_score?: number | null
          alcohol_ml?: number
          coffee_cups?: number
          created_at?: string
          id?: string
          log_date?: string
          notes?: string | null
          tea_cups?: number
          updated_at?: string
          user_id?: string
          water_ml?: number
        }
        Relationships: []
      }
      password_reset_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          used?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      pending_notifications: {
        Row: {
          action_type: string
          client_user_id: string
          created_at: string | null
          details: string
          id: string
          is_sent: boolean | null
          trainer_user_id: string
        }
        Insert: {
          action_type: string
          client_user_id: string
          created_at?: string | null
          details: string
          id?: string
          is_sent?: boolean | null
          trainer_user_id: string
        }
        Update: {
          action_type?: string
          client_user_id?: string
          created_at?: string | null
          details?: string
          id?: string
          is_sent?: boolean | null
          trainer_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          telegram_chat_id: string | null
          telegram_link_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone: string
          telegram_chat_id?: string | null
          telegram_link_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          telegram_chat_id?: string | null
          telegram_link_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_sessions: {
        Row: {
          created_at: string
          deducted_at: string | null
          duration_minutes: number
          id: string
          is_deducted: boolean
          is_recurring: boolean
          notes: string | null
          package_id: string | null
          recurrence_day: number | null
          recurrence_time: string | null
          recurring_exceptions: string[]
          session_date: string
          session_time: string | null
          trainer_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deducted_at?: string | null
          duration_minutes?: number
          id?: string
          is_deducted?: boolean
          is_recurring?: boolean
          notes?: string | null
          package_id?: string | null
          recurrence_day?: number | null
          recurrence_time?: string | null
          recurring_exceptions?: string[]
          session_date: string
          session_time?: string | null
          trainer_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deducted_at?: string | null
          duration_minutes?: number
          id?: string
          is_deducted?: boolean
          is_recurring?: boolean
          notes?: string | null
          package_id?: string | null
          recurrence_day?: number | null
          recurrence_time?: string | null
          recurring_exceptions?: string[]
          session_date?: string
          session_time?: string | null
          trainer_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          idempotency_key: string | null
          package_id: string
          reason: string
          session_id: string | null
          used_after: number
          used_before: number
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          idempotency_key?: string | null
          package_id: string
          reason: string
          session_id?: string | null
          used_after: number
          used_before: number
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          idempotency_key?: string | null
          package_id?: string
          reason?: string
          session_id?: string | null
          used_after?: number
          used_before?: number
          user_id?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          answers: number[]
          created_at: string
          health_max: number
          health_score: number
          id: string
          nutrition_max: number
          nutrition_score: number
          overall_percentage: number
          user_id: string
        }
        Insert: {
          answers?: number[]
          created_at?: string
          health_max: number
          health_score: number
          id?: string
          nutrition_max: number
          nutrition_score: number
          overall_percentage: number
          user_id: string
        }
        Update: {
          answers?: number[]
          created_at?: string
          health_max?: number
          health_score?: number
          id?: string
          nutrition_max?: number
          nutrition_score?: number
          overall_percentage?: number
          user_id?: string
        }
        Relationships: []
      }
      trainer_blocks: {
        Row: {
          block_date: string | null
          block_time: string
          block_type: string
          created_at: string
          duration_minutes: number
          id: string
          is_recurring: boolean
          linked_session_id: string | null
          recurrence_day: number | null
          title: string | null
          trainer_user_id: string
          updated_at: string
        }
        Insert: {
          block_date?: string | null
          block_time: string
          block_type?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_recurring?: boolean
          linked_session_id?: string | null
          recurrence_day?: number | null
          title?: string | null
          trainer_user_id: string
          updated_at?: string
        }
        Update: {
          block_date?: string | null
          block_time?: string
          block_type?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_recurring?: boolean
          linked_session_id?: string | null
          recurrence_day?: number | null
          title?: string | null
          trainer_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_blocks_linked_session_id_fkey"
            columns: ["linked_session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_client_order: {
        Row: {
          client_order: string[]
          id: string
          trainer_user_id: string
          updated_at: string
        }
        Insert: {
          client_order?: string[]
          id?: string
          trainer_user_id: string
          updated_at?: string
        }
        Update: {
          client_order?: string[]
          id?: string
          trainer_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      trainer_working_hours: {
        Row: {
          created_at: string
          days_off: number[]
          id: string
          trainer_user_id: string
          updated_at: string
          work_end_hour: number
          work_start_hour: number
        }
        Insert: {
          created_at?: string
          days_off?: number[]
          id?: string
          trainer_user_id: string
          updated_at?: string
          work_end_hour?: number
          work_start_hour?: number
        }
        Update: {
          created_at?: string
          days_off?: number[]
          id?: string
          trainer_user_id?: string
          updated_at?: string
          work_end_hour?: number
          work_start_hour?: number
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
      whoop_metrics: {
        Row: {
          avg_heart_rate: number | null
          calories: number | null
          created_at: string
          hrv: number | null
          id: string
          max_heart_rate: number | null
          metric_date: string
          raw_data: Json | null
          recovery_score: number | null
          resting_heart_rate: number | null
          sleep_duration_minutes: number | null
          strain: number | null
          updated_at: string
          user_id: string
          workout_count: number | null
        }
        Insert: {
          avg_heart_rate?: number | null
          calories?: number | null
          created_at?: string
          hrv?: number | null
          id?: string
          max_heart_rate?: number | null
          metric_date: string
          raw_data?: Json | null
          recovery_score?: number | null
          resting_heart_rate?: number | null
          sleep_duration_minutes?: number | null
          strain?: number | null
          updated_at?: string
          user_id: string
          workout_count?: number | null
        }
        Update: {
          avg_heart_rate?: number | null
          calories?: number | null
          created_at?: string
          hrv?: number | null
          id?: string
          max_heart_rate?: number | null
          metric_date?: string
          raw_data?: Json | null
          recovery_score?: number | null
          resting_heart_rate?: number | null
          sleep_duration_minutes?: number | null
          strain?: number | null
          updated_at?: string
          user_id?: string
          workout_count?: number | null
        }
        Relationships: []
      }
      whoop_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string | null
          scopes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scopes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "trainer" | "client"
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
      app_role: ["admin", "trainer", "client"],
    },
  },
} as const
