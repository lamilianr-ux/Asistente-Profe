import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

export default {
  async fetch(request, env, ctx) {
    const KAPSO_API_KEY = env.KAPSO_API_KEY;
    const GEMINI_API_KEY = env.GEMINI_API_KEY;

    if (request.method === "GET") {
      const url = new URL(request.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === "token_secreto_profe") {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Verificación fallida", { status: 403 });
    }

    if (request.method === "POST") {
      const data = await request.json();
      const changes = data.entry?.[0]?.changes?.[0]?.value;
      const messageObj = changes?.messages?.[0];
      
      if (!messageObj) {
        return new Response("OK", { status: 200 });
      }

      const senderPhone = messageObj.from;
      const senderName = changes.contacts?.[0]?.profile?.name || "Usuario";
      const messageText = messageObj.text?.body || messageObj.interactive?.button_reply?.title || "Mensaje interactivo";

      const now = new Date();
      const options = { timeZone: "America/Bogota", weekday: 'long', hour: 'numeric', minute: 'numeric', hour12: true };
      const formatter = new Intl.DateTimeFormat('es-CO', options);
      const partesFecha = formatter.formatToParts(now);
      let diaActual = "", horaActual = "", meridiano = "";
      partesFecha.forEach(p => {
        if (p.type === 'weekday') diaActual = p.value;
        if (p.type === 'hour') horaActual = p.value;
        if (p.type === 'dayPeriod') meridiano = p.value;
      });

      const esFinDeSemana = (diaActual === "sábado" || diaActual === "domingo");
      const horaNum = parseInt(horaActual);
      const esHorarioLaboral Colegio = (!esFinDeSemana && 
        ((horaNum >= 6 && horaNum < 12 && meridiano.toLowerCase().includes("a")) || 
         (horaNum === 12 && meridiano.toLowerCase().includes("p")) || 
         (horaNum === 1 && meridiano.toLowerCase().includes("p"))));

      const systemInstruction = `
        Eres el "Asistente del profe Luis Milián", docente de matemáticas. Tu tono es amistoso, pero muy formal y amable.
        Hoy es ${diaActual} y son las ${horaActual} ${meridiano} (hora de Colombia).
        
        REGLAS ESTRICTAS DE RESPUESTA:
        1. Identifica al usuario por el contexto de su mensaje.
        2. Si es familiar, amigo o compañero de trabajo y estamos en horario laboral escolar, indícale cordialmente que el profesor Luis Milián está en jornada de clase y le escribirá personalmente apenas se desocupe.
        3. Si es padre, madre, acudiente o estudiante:
           - Fines de semana: No atiendes asuntos escolares. Infórmale amablemente que la atención es de lunes a viernes.
           - Lunes a viernes en horario escolar (6:30 am a 1:00 pm): Pregúntale si tienen una cita agendada previamente. Si confirman que sí, toma sus datos. Si no, explícale que el profesor está dictando clase y el horario de atención es de 2:00 pm a 6:00 pm.
           - Lunes a viernes de 2:00 pm a 6:00 pm: Atiéndelos cordialmente, toma el nombre del estudiante, grado y motivo de la consulta.
        4. Sé breve, claro y educado en español.
      `;

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const promptCompleto = `Contexto: El usuario ${senderName} (${senderPhone}) envió el mensaje: "${messageText}". Genera la respuesta adecuada siguiendo tu instrucción de sistema.`;

      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: promptCompleto }] }]
        })
      });

      const geminiData = await geminiResponse.json();
      const respuestaIA = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Hola, el profesor Luis Milián te responderá en breve.";

      const whatsappUrl = 'https://api.kapso.ai/meta/whatsapp';
      await fetch(whatsappUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${KAPSO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: senderPhone,
          message: respuestaIA
        })
      });

      return new Response("Evento procesado", { status: 200 });
    }
    return new Response("Método no permitido", { status: 405 });
  }
};
                        
