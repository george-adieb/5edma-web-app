import { supabase } from './src/lib/supabase.js';

async function check() {
  const { data, error } = await supabase.from('follow_up_logs').select('*').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}

check();
