import { createClient } from '@supabase/supabase-js';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

