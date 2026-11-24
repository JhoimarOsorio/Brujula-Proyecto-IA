document.addEventListener("DOMContentLoaded", () => {
  const B = window.Brujula;
  const $ = (id) => document.getElementById(id);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const EJEMPLOS = [
    "¿Cuándo es la sesión de IA?",
    "¿Cuándo se entrega el proyecto?",
    "¿Dónde veo las reglas de convivencia?",
    "¿Cuánto me falta para aprobar el módulo?",
  ];
  let ejemplo = 0,
    rec = null,
    forzado = null,
    sesion = 0,
    ocupado = false,
    silencio = false;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  // Escucha con el micrófono real si el navegador lo permite; si no, simula la voz.
  function escuchar() {
    return new Promise((res) => {
      const simular = (ms = 2200) => {
        const t = forzado || EJEMPLOS[ejemplo++ % EJEMPLOS.length];
        const pausa = forzado ? 900 : ms;
        forzado = null;
        setTimeout(() => res({ texto: t, simulado: true }), pausa);
      };
      if (forzado || !SR) return simular();
      let listo = false;
      try {
        rec = new SR();
        rec.lang = "es-CO";
        rec.interimResults = false;
        rec.onresult = (e) => {
          listo = true;
          res({ texto: e.results[0][0].transcript, simulado: false });
        };
        rec.onerror = (e) => {
          if (listo) return;
          listo = true;
          e.error === "no-speech"
            ? res({ texto: "", simulado: false })
            : simular(1200);
        };
        rec.onend = () => {
          if (!listo) {
            listo = true;
            res({ texto: "", simulado: false });
          }
        };
        rec.start();
      } catch (_) {
        simular();
      }
    });
  }

  // 1. Micrófono de dictado en la barra de escritura
  const mic = $("btn-microfono"),
    input = $("pregunta"),
    aviso = $("estado-voz");
  mic.addEventListener("click", async () => {
    if (mic.getAttribute("aria-pressed") === "true") {
      if (rec) rec.stop();
      return;
    }
    mic.setAttribute("aria-pressed", "true");
    aviso.textContent = "Escuchando… habla ahora";
    const r = await escuchar();
    mic.setAttribute("aria-pressed", "false");
    if (r.texto) {
      input.value = B.protegerDatos(r.texto);
      input.focus();
      aviso.textContent = r.simulado
        ? "Dictado simulado: escribí una pregunta de ejemplo. Revísala y envía."
        : "Esto entendí. Revísalo y envía.";
    } else {
      aviso.textContent = "No te escuché. Intenta de nuevo.";
    }
  });

  // 2. Agente de voz
  const dlg = $("agente"),
    orbe = $("orbe"),
    estado = $("agente-estado");
  const lineaTu = $("linea-tu"),
    lineaIa = $("linea-ia");
  const fase = (f, t) => {
    orbe.dataset.fase = f;
    estado.textContent = t;
  };

  function hablar(texto) {
    return new Promise((res) => {
      if (silencio || !window.speechSynthesis)
        return setTimeout(res, Math.min(5000, texto.length * 45));
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "es-CO";
      const voz = speechSynthesis
        .getVoices()
        .find((v) => v.lang.startsWith("es"));
      if (voz) u.voice = voz;
      u.onend = u.onerror = res;
      speechSynthesis.speak(u);
    });
  }

  function responder(textoProtegido) {
    if (B.requiereHumano(textoProtegido))
      return "Este tema lo responde una persona. Te recomiendo hablar con un coach.";
    const r = B.buscarEnBase(textoProtegido);
    return r
      ? `${r.respuesta} Fuente: ${r.fuente}.`
      : "No encontré esa información y no quiero inventar una respuesta. Puedes reformular la pregunta o hablar con un coach.";
  }

  function detener() {
    sesion++;
    ocupado = false;
    if (rec) {
      try {
        rec.abort();
      } catch (_) {}
    }
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  async function turno() {
    if (ocupado) return;
    ocupado = true;
    const s = ++sesion;
    if (window.speechSynthesis) speechSynthesis.cancel();
    fase("escuchando", "Escuchando… habla ahora");
    const r = await escuchar();
    if (s !== sesion) return;
    if (!r.texto) {
      fase(
        "inactivo",
        "No te escuché. Toca la brújula para intentar otra vez.",
      );
      ocupado = false;
      return;
    }
    const p = B.protegerDatos(r.texto);
    lineaTu.textContent = p;
    lineaTu.hidden = false;
    fase("pensando", "Buscando en los documentos de la cohorte…");
    await esperar(1100);
    if (s !== sesion) return;
    const rep = responder(p);
    lineaIa.textContent = rep;
    lineaIa.hidden = false;
    B.procesarPregunta(p); // deja la misma conversación visible en el chat
    fase("hablando", "Brújula está respondiendo…");
    await hablar(rep);
    if (s !== sesion) return;
    fase("inactivo", "Toca la brújula para preguntar de nuevo");
    ocupado = false;
  }

  $("btn-agente-voz").addEventListener("click", () => {
    lineaTu.hidden = true;
    const saludo =
      "Hola, soy Brújula, una inteligencia artificial. Pregúntame por horarios, entregas o convivencia.";
    lineaIa.textContent = saludo;
    lineaIa.hidden = false;
    fase("inactivo", "Toca la brújula y haz tu pregunta");
    dlg.showModal();
    hablar(saludo);
  });
  orbe.addEventListener("click", turno);
  dlg.querySelectorAll(".agente-sug button").forEach((b) =>
    b.addEventListener("click", () => {
      forzado = b.dataset.q;
      turno();
    }),
  );
  $("btn-silencio").addEventListener("click", (e) => {
    silencio = !silencio;
    e.currentTarget.setAttribute("aria-pressed", String(silencio));
    e.currentTarget.textContent = silencio ? "Activar voz" : "Silenciar voz";
    if (silencio && window.speechSynthesis) speechSynthesis.cancel();
  });
  $("agente-cerrar").addEventListener("click", () => dlg.close());
  $("agente-coach").addEventListener("click", () => {
    dlg.close();
    B.mostrarAvisoCoach();
  });
  dlg.addEventListener("close", detener);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
});
