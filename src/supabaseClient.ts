import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://leyncevwcnedyaynlcxl.supabase.co";
const supabaseAnonKey = "sb_publishable_NoGB2AXcB05RHTdRi2t6Qg_IYiCIsMZ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);