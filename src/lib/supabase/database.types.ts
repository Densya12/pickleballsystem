
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "club_invites": {
                  Row: {
                    "club_id": string,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"revoked_at": string | null,"token": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"token"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"token"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_invites_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"club_staff": {
                  Row: {
                    "club_id": string,"created_at": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"role": string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_staff_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "cash_accepted": boolean,"city": string | null,"created_at": string,"created_by": string | null,"default_call_mode": string,"default_fee": number,"default_matchmaking": string,"default_points": number,"default_rotation": string,"entry_code": string,"gcash_name": string | null,"gcash_number": string | null,"id": string,"name": string,"payment_method": string,"payment_method_other": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cash_accepted"?: boolean,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_call_mode"?: string,"default_fee"?: number,"default_matchmaking"?: string,"default_points"?: number,"default_rotation"?: string,"entry_code"?: string,"gcash_name"?: string | null,"gcash_number"?: string | null,"id"?: string,"name": string,"payment_method"?: string,"payment_method_other"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "cash_accepted"?: boolean,"city"?: string | null,"created_at"?: string,"created_by"?: string | null,"default_call_mode"?: string,"default_fee"?: number,"default_matchmaking"?: string,"default_points"?: number,"default_rotation"?: string,"entry_code"?: string,"gcash_name"?: string | null,"gcash_number"?: string | null,"id"?: string,"name"?: string,"payment_method"?: string,"payment_method_other"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"courts": {
                  Row: {
                    "current_game_id": string | null,"format": string,"id": string,"label": string,"number": number,"session_id": string,"staying_ids": (string)[],"waiting_since": string | null,"winner_streak": number
                  }
                  ComputedFields: never
                  Insert: {
                    "current_game_id"?: string | null,"format"?: string,"id"?: string,"label": string,"number": number,"session_id": string,"staying_ids"?: (string)[],"waiting_since"?: string | null,"winner_streak"?: number
                  }
                  Update: {
                    "current_game_id"?: string | null,"format"?: string,"id"?: string,"label"?: string,"number"?: number,"session_id"?: string,"staying_ids"?: (string)[],"waiting_since"?: string | null,"winner_streak"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "courts_current_game_id_fkey"
      columns: ["current_game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "courts_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "actor": string | null,"created_at": string,"id": string,"payload": NonNullable<Json>,"session_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"session_id": string,"type": string
                  }
                  Update: {
                    "actor"?: string | null,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"session_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "call_note": Json | null,"court_id": string,"ended_at": string | null,"format": string,"id": string,"number": number,"player_ids": (string)[],"session_id": string,"started_at": string,"stayed_ids": (string)[] | null,"winner_ids": (string)[] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "call_note"?: Json | null,"court_id": string,"ended_at"?: string | null,"format"?: string,"id"?: string,"number": number,"player_ids": (string)[],"session_id": string,"started_at"?: string,"stayed_ids"?: (string)[] | null,"winner_ids"?: (string)[] | null
                  }
                  Update: {
                    "call_note"?: Json | null,"court_id"?: string,"ended_at"?: string | null,"format"?: string,"id"?: string,"number"?: number,"player_ids"?: (string)[],"session_id"?: string,"started_at"?: string,"stayed_ids"?: (string)[] | null,"winner_ids"?: (string)[] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "club_id": string,"created_at": string,"display_name": string,"dues_status": string,"id": string,"level": string,"notes": string | null,"skill": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"display_name": string,"dues_status"?: string,"id"?: string,"level"?: string,"notes"?: string | null,"skill"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"display_name"?: string,"dues_status"?: string,"id"?: string,"level"?: string,"notes"?: string | null,"skill"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"created_at": string,"id": string,"method": string | null,"reference_digits": string | null,"session_id": string,"session_player_id": string,"status": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: string,"method"?: string | null,"reference_digits"?: string | null,"session_id": string,"session_player_id": string,"status": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: string,"method"?: string | null,"reference_digits"?: string | null,"session_id"?: string,"session_player_id"?: string,"status"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_session_player_id_fkey"
      columns: ["session_player_id"]
isOneToOne: true
      referencedRelation: "session_players"
      referencedColumns: ["id"]
    }
                  ]
                },"session_players": {
                  Row: {
                    "client_id": string | null,"created_at": string,"device_id": string | null,"display_name": string,"games_played": number,"id": string,"is_walk_in": boolean,"level": string,"member_id": string | null,"not_ready_at": string | null,"payment_status": string,"queue_pos": number,"session_id": string,"skill": number | null,"skip_count": number,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"device_id"?: string | null,"display_name": string,"games_played"?: number,"id"?: string,"is_walk_in"?: boolean,"level"?: string,"member_id"?: string | null,"not_ready_at"?: string | null,"payment_status"?: string,"queue_pos"?: number,"session_id": string,"skill"?: number | null,"skip_count"?: number,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"device_id"?: string | null,"display_name"?: string,"games_played"?: number,"id"?: string,"is_walk_in"?: boolean,"level"?: string,"member_id"?: string | null,"not_ready_at"?: string | null,"payment_status"?: string,"queue_pos"?: number,"session_id"?: string,"skill"?: number | null,"skip_count"?: number,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_players_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_players_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "call_mode": string,"cash_accepted": boolean,"club_id": string,"court_formats": (string)[],"courts_count": number,"created_at": string,"created_by": string | null,"display_token": string,"ended_at": string | null,"ends_at": string,"fee": number,"gcash_name": string | null,"gcash_number": string | null,"id": string,"join_code": string,"matchmaking": string,"name": string,"pay_first": boolean,"payment_method": string,"payment_method_other": string | null,"points_to": number,"rotation": string,"started_at": string | null,"starts_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "call_mode"?: string,"cash_accepted"?: boolean,"club_id": string,"court_formats": (string)[],"courts_count": number,"created_at"?: string,"created_by"?: string | null,"display_token"?: string,"ended_at"?: string | null,"ends_at": string,"fee": number,"gcash_name"?: string | null,"gcash_number"?: string | null,"id"?: string,"join_code"?: string,"matchmaking"?: string,"name": string,"pay_first"?: boolean,"payment_method"?: string,"payment_method_other"?: string | null,"points_to": number,"rotation": string,"started_at"?: string | null,"starts_at": string,"status"?: string
                  }
                  Update: {
                    "call_mode"?: string,"cash_accepted"?: boolean,"club_id"?: string,"court_formats"?: (string)[],"courts_count"?: number,"created_at"?: string,"created_by"?: string | null,"display_token"?: string,"ended_at"?: string | null,"ends_at"?: string,"fee"?: number,"gcash_name"?: string | null,"gcash_number"?: string | null,"id"?: string,"join_code"?: string,"matchmaking"?: string,"name"?: string,"pay_first"?: boolean,"payment_method"?: string,"payment_method_other"?: string | null,"points_to"?: number,"rotation"?: string,"started_at"?: string | null,"starts_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"add_walk_in":
{ Args: { "p_client_id"?: string,"p_display_name": string,"p_level": string,"p_member_id"?: string,"p_payment"?: string,"p_reference"?: string,"p_session_id": string }; Returns: string
                           },
"call_mixed":
{ Args: { "p_court_id": string }; Returns: string
                           },
"call_next":
{ Args: { "p_court_id": string }; Returns: string
                           },
"checkin_preview":
{ Args: { "p_join_code": string }; Returns: {
              "courts_count": number,"ends_at": string,"fee": number,"gcash_name": string,"gcash_number": string,"name": string,"pay_first": boolean,"starts_at": string,"status": string,"waiting": number
            }[]
                           },
"club_entry":
{ Args: { "p_code": string }; Returns: {
              "club_name": string,"join_code": string,"status": string
            }[]
                           },
"confirm_payment":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"create_club":
{ Args: { "p_city"?: string,"p_name": string }; Returns: string
                           },
"create_session":
{ Args: { "p_club_id": string,"p_court_formats"?: (string)[],"p_courts_count": number,"p_ends_at": string,"p_fee"?: number,"p_name": string,"p_pay_first"?: boolean,"p_points_to"?: number,"p_rotation"?: string,"p_start"?: boolean,"p_starts_at": string }; Returns: string
                           },
"delete_draft_session":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"end_session":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"finish_game":
{ Args: { "p_court_id": string,"p_game_id": string,"p_winner_ids"?: (string)[] }; Returns: string
                           },
"invite_preview":
{ Args: { "p_token": string }; Returns: {
              "already_staff": boolean,"club_name": string,"status": string
            }[]
                           },
"is_checkin_open":
{ Args: { "p_join_code": string }; Returns: boolean
                           },
"is_club_owner":
{ Args: { "p_club_id": string }; Returns: boolean
                           },
"is_club_staff":
{ Args: { "p_club_id": string }; Returns: boolean
                           },
"is_own_player":
{ Args: { "p_session_player_id": string }; Returns: boolean
                           },
"is_session_player":
{ Args: { "p_session_id": string }; Returns: boolean
                           },
"is_session_staff":
{ Args: { "p_session_id": string }; Returns: boolean
                           },
"join_session":
{ Args: { "p_display_name": string,"p_join_code": string,"p_level"?: string,"p_method"?: string,"p_reference"?: string }; Returns: string
                           },
"list_club_staff":
{ Args: { "p_club_id": string }; Returns: {
              "created_at": string,"display_name": string,"email": string,"role": string,"user_id": string
            }[]
                           },
"my_last_profile":
{ Args: { "p_join_code": string }; Returns: {
              "display_name": string,"level": string
            }[]
                           },
"my_last_profile_v2":
{ Args: { "p_join_code": string }; Returns: {
              "display_name": string,"level": string,"skill": number
            }[]
                           },
"my_player":
{ Args: { "p_session_id": string }; Returns: {
              "display_name": string,"games_played": number,"id": string,"level": string,"not_ready_at": string,"queue_pos": number,"status": string
            }[]
                           },
"pause_player":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"player_leave":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"player_not_ready":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"player_pause":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"player_resume":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"player_submit_reference":
{ Args: { "p_player_id": string,"p_reference": string }; Returns: undefined
                           },
"queue_preview":
{ Args: { "p_session_id": string }; Returns: Json
                           },
"regenerate_entry_code":
{ Args: { "p_club_id": string }; Returns: string
                           },
"remove_player":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"remove_staff":
{ Args: { "p_club_id": string,"p_user_id": string }; Returns: undefined
                           },
"resume_player":
{ Args: { "p_player_id": string }; Returns: undefined
                           },
"save_player_as_member":
{ Args: { "p_create_new"?: boolean,"p_member_id"?: string,"p_player_id": string }; Returns: string
                           },
"session_eligible_count":
{ Args: { "p_session_id": string }; Returns: number
                           },
"set_court_format":
{ Args: { "p_court_id": string,"p_format": string }; Returns: undefined
                           },
"set_player_level":
{ Args: { "p_player_id": string,"p_skill": number }; Returns: undefined
                           },
"set_session_call_mode":
{ Args: { "p_call_mode": string,"p_session_id": string }; Returns: undefined
                           },
"set_session_matchmaking":
{ Args: { "p_matchmaking": string,"p_session_id": string }; Returns: undefined
                           },
"set_session_rotation":
{ Args: { "p_rotation": string,"p_session_id": string }; Returns: undefined
                           },
"sit_out":
{ Args: { "p_player_id": string }; Returns: string
                           },
"start_session":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"swap_not_ready":
{ Args: { "p_court_id": string,"p_player_id": string }; Returns: string
                           },
"swap_sides":
{ Args: { "p_court_id": string,"p_other_id": string,"p_player_id": string }; Returns: undefined
                           },
"undo_last":
{ Args: { "p_session_id": string }; Returns: string
                           },
"undo_payment":
{ Args: { "p_player_id": string }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
