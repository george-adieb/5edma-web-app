import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: { user }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'adib.george1212@gmail.com',  // using the mock email or whatever
    password: 'password123'  // Just hoping for an open connection or we can use admin key if any
  });
  
  if (authErr && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('Cant login natively, using anon key:', authErr.message);
  }

  const payload = {
    student_id: '901678a8-0ea0-4875-bdd9-518ee1a48289', // Abanoub
    type: 'مكالمة',
    notes: 'Test debugging note',
    contact_status: 'منتظم',
    // follow_up_id omitted
  };
  console.log('Sending payload:', payload);

  const { data, error } = await supabase.from('follow_up_logs').insert(payload).select();
  if (error) {
    console.error('SUPABASE ERROR:', error);
  } else {
    console.log('SUPABASE SUCCESS:', data);
  }
}
run();
