import {createClient} from 'npm:@supabase/supabase-js@2';
import {createMemberHandler} from './handler.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}'))[0] as string;
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createMemberHandler({
 async verifyToken(token){const {data,error}=await admin.auth.getUser(token);return error||!data.user?null:{id:data.user.id}},
 async getProfile(id){const {data,error}=await admin.from('profiles').select('role,family_id').eq('id',id).maybeSingle();if(error)throw error;return data},
 async createUser(email,password,name){const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name,must_change_password:true}});if(error||!data.user)throw error||Error('create failed');return {id:data.user.id}},
 async insertProfile(profile){const {error}=await admin.from('profiles').insert(profile);if(error)throw error},
 async deleteUser(id){const {error}=await admin.auth.admin.deleteUser(id);if(error)throw error}
},Deno.env.get('ALLOWED_ORIGIN')||'https://jara-cyber.github.io'));
