import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://merqbgxwkajuzxcwultp.supabase.co', 'sb_publishable_Q9nd1Y8TNzuEG-47e3wSDQ_NFcO-ccp')

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@church.com',
    password: 'password123'
  })
  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      console.log('User does not exist or wrong password. Trying to sign up...');
      const { data: suData, error: suError } = await supabase.auth.signUp({
        email: 'admin@church.com',
        password: 'password123'
      })
      console.log('Signup result:', suError || 'Success! Created admin@church.com / password123')
      
      if (!suError && suData?.user) {
        // try to insert profile
        await supabase.from('profiles').insert([
          { id: suData.user.id, role: 'ADMIN', full_name: 'Admin User' }
        ])
        console.log('Profile created.')
      }
    } else {
      console.log('Error:', error)
    }
  } else {
    console.log('Login successful! admin@church.com / password123')
  }
}
test()
