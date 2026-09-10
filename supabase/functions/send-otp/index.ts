import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendOtpRequest {
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email } = (await req.json()) as SendOtpRequest;

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "A valid email is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // generateLink creates the OTP code server-side WITHOUT sending an email.
    // We extract the 6-digit email_otp and send our own email with just the code.
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase().trim(),
      options: { shouldCreateUser: true },
    });

    if (error || !data?.properties?.email_otp) {
      return new Response(JSON.stringify({ error: "Could not generate a login code." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const otpCode = data.properties.email_otp;

    // Send the code via Resend API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      // Dev/test fallback: return the code in the response so the UI can display it.
      // In production, set RESEND_API_KEY as an edge function secret.
      return new Response(
        JSON.stringify({ success: true, devCode: otpCode }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "The Nest <onboarding@resend.dev>",
        to: email.toLowerCase().trim(),
        subject: "Your The Nest login code",
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#050505;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
<tr><td align="center">
<table width="420" cellpadding="0" cellspacing="0" style="background:#121215;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px;">
<tr><td align="center" style="padding-bottom:8px;">
<span style="font-size:28px;font-weight:600;color:#f59e0b;letter-spacing:-0.02em;">The Nest</span>
</td></tr>
<tr><td align="center" style="padding-bottom:32px;">
<span style="font-size:13px;color:#71717a;letter-spacing:0.04em;text-transform:uppercase;">Private messaging</span>
</td></tr>
<tr><td align="center" style="padding-bottom:8px;">
<span style="font-size:15px;color:#a1a1aa;">Your one-time login code is:</span>
</td></tr>
<tr><td align="center" style="padding:8px 0 32px;">
<span style="font-size:42px;font-weight:600;color:#ffffff;letter-spacing:0.3em;font-family:'Outfit',Helvetica,Arial,sans-serif;">${otpCode}</span>
</td></tr>
<tr><td align="center">
<span style="font-size:13px;color:#52525b;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</span>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error("Resend API error:", errText);
      return new Response(JSON.stringify({ error: `Email service error: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
