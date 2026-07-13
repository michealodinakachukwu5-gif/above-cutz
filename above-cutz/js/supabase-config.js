// ABOVE CUTZ — Supabase config
// 1. Create a new Supabase project for this client (separate from Ad'sHub).
// 2. Paste the Project URL and anon public key below.
// 3. Run schema.sql in the SQL editor.
// 4. Create a Storage bucket named "media" (public).
// 5. Create one Auth user (email/password) for the barber/admin login.

const SUPABASE_URL = "https://nzioienealjwgseebpkv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aW9pZW5lYWxqd2dzZWVicGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzAyODgsImV4cCI6MjA5OTQ0NjI4OH0.VBczl_lx5km_WAALE15_jKWnI6IefhhBaeEiLSLk604";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
