document.addEventListener("DOMContentLoaded", () => {
  // Base de conocimiento ficticia de la cohorte (semanas 1 y 2)
  const BASE_CONOCIMIENTO = [
    {
      palabrasClave: [
        "sesion",
        "sesión",
        "ia",
        "jueves",
        "salon",
        "salón",
        "clase",
      ],
      respuesta:
        "La sesión de IA es el jueves a las 2:00 p. m. Será en el salón del clan. Llega 10 minutos antes para conectar tu equipo.",
      fuente: "Calendario de la cohorte",
    },
    {
      palabrasClave: [
        "proyecto",
        "entrega",
        "entregar",
        "github",
        "viernes",
        "plazo",
        "fecha",
      ],
      respuesta:
        "El proyecto de las semanas 1 y 2 se entrega este viernes antes de las 6:00 p. m. subiendo el enlace de tu repositorio en GitHub.",
      fuente: "Guía del proyecto",
    },
    {
      palabrasClave: [
        "reglas",
        "convivencia",
        "normas",
        "comportamiento",
        "asistencia",
        "tarde",
      ],
      respuesta:
        "Las reglas de convivencia, puntualidad y uso de espacios están disponibles en el canal general de la cohorte y en la carpeta inicial del clan.",
      fuente: "Manual de convivencia",
    },
    {
      palabrasClave: ["horario", "horarios", "hora", "entrada", "salida"],
      respuesta:
        "El horario habitual de la cohorte es de lunes a viernes, de 8:00 a. m. a 12:00 m. o de 2:00 p. m. a 6:00 p. m. según tu jornada.",
      fuente: "Calendario de la cohorte",
    },
  ];

  // Referencias del DOM
  const tabs = document.querySelectorAll(".tab");
  const paneles = document.querySelectorAll('[role="tabpanel"]');
  const botonesEstado = document.querySelectorAll(".btn-estado");
  const estadosChat = document.querySelectorAll(".estado");
  const dinamico = document.getElementById("dinamico");
  const form = document.getElementById("form");
  const inputPregunta = document.getElementById("pregunta");
  const bannerCoach = document.getElementById("banner-coach");

  let ultimaPregunta = "";
  let temporizadorRespuesta = null;

  // 1. Navegación por pestañas
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const destino = tab.dataset.tab;

      tabs.forEach((t) => {
        t.setAttribute("aria-selected", String(t === tab));
      });

      paneles.forEach((panel) => {
        panel.hidden = panel.id !== destino;
      });
    });
  });

  // 2. Cambio de estado en la vista previa
  function activarEstado(nombreEstado) {
    estadosChat.forEach((el) => {
      el.classList.toggle("on", el.dataset.e === nombreEstado);
    });

    botonesEstado.forEach((btn) => {
      btn.setAttribute(
        "aria-pressed",
        String(btn.dataset.estado === nombreEstado),
      );
    });
  }

  botonesEstado.forEach((btn) => {
    btn.addEventListener("click", () => {
      clearTimeout(temporizadorRespuesta);
      activarEstado(btn.dataset.estado);
    });
  });

  // 3. Reglas de IA responsable
  function protegerDatos(texto) {
    return (
      texto
        // Correos electrónicos
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[correo]")
        // Celulares colombianos (10 dígitos empezando por 3, con posible espacio o guion)
        .replace(/\b3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, "[celular]")
        // Números de documento (6 a 10 dígitos)
        .replace(/\b\d{6,10}\b/g, "[documento]")
    );
  }

  function requiereHumano(texto) {
    const limpio = texto.toLowerCase();
    const terminosAltoImpacto = [
      "nota",
      "notas",
      "calificación",
      "calificacion",
      "aprobar",
      "perder",
      "reprobar",
      "salud",
      "enfermo",
      "enferma",
      "médico",
      "medico",
      "psicólogo",
      "psicologo",
      "dinero",
      "pago",
      "beca",
      "plata",
      "permanencia",
      "expulsar",
      "sanción",
      "sancion",
      "decisión sobre una persona",
      "decision sobre una persona",
    ];
    const tokens = new Set(normalizar(texto).match(/[a-z0-9]+/g) || []);
    return terminosAltoImpacto.some(
      (t) =>
        tokens.has(normalizar(t)) ||
        (t.includes(" ") && normalizar(texto).includes(normalizar(t))),
    );
  }

  function aviso(fuentes) {
    if (!fuentes || fuentes.length === 0) {
      return "Respuesta generada con IA sin fuentes: no la uses para decisiones importantes.";
    }
    const cantidad = fuentes.length;
    const etiqueta = cantidad === 1 ? "1 fuente" : `${cantidad} fuentes`;
    return `Respuesta generada con IA a partir de ${etiqueta}: ${fuentes.join(", ")}. Verifícala en la fuente.`;
  }

  // Utilidad para normalizar texto y buscar coincidencias
  function normalizar(texto) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function buscarEnBase(texto) {
    const tokens = new Set(normalizar(texto).match(/[a-z0-9]+/g) || []);
    let mejor = null,
      max = 0;
    BASE_CONOCIMIENTO.forEach((item) => {
      const puntos = item.palabrasClave.filter((kw) =>
        tokens.has(normalizar(kw)),
      ).length;
      if (puntos > max) {
        max = puntos;
        mejor = item;
      }
    });
    return mejor;
  }

  // Construcción segura del DOM (usando textContent, nunca innerHTML para datos de usuario)
  function crearBurbujaPregunta(textoSeguro) {
    const divQ = document.createElement("div");
    divQ.className = "q";
    divQ.textContent = textoSeguro;
    return divQ;
  }

  function mostrarAvisoCoach() {
    bannerCoach.textContent =
      "Solicitud enviada (simulación): un coach de tu cohorte se pondrá en contacto contigo pronto.";
    bannerCoach.hidden = false;
    bannerCoach.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function limpiarDinamico() {
    clearTimeout(temporizadorRespuesta);
    dinamico.replaceChildren();
    activarEstado("vacio");
    inputPregunta.value = "";
    inputPregunta.focus();
  }

  function renderizarDerivacion(textoSeguro) {
    dinamico.replaceChildren();
    dinamico.appendChild(crearBurbujaPregunta(textoSeguro));

    const tarjeta = document.createElement("div");
    tarjeta.className = "err humano";
    tarjeta.setAttribute("role", "alert");

    const titulo = document.createElement("h3");
    titulo.textContent = "Este tema lo responde una persona";

    const desc = document.createElement("p");
    desc.textContent =
      "Las notas, la salud, el dinero y las decisiones sobre una persona las revisa un coach. Yo solo informo y nunca decido.";

    const acciones = document.createElement("div");
    acciones.className = "acciones";

    const btnCoach = document.createElement("button");
    btnCoach.type = "button";
    btnCoach.className = "btn-primario btn-coach";
    btnCoach.textContent = "Hablar con un coach";

    acciones.appendChild(btnCoach);
    tarjeta.append(titulo, desc, acciones);
    dinamico.appendChild(tarjeta);
  }

  function renderizarCargando(textoSeguro) {
    dinamico.replaceChildren();
    dinamico.appendChild(crearBurbujaPregunta(textoSeguro));

    const box = document.createElement("div");
    box.className = "pensando";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");

    const dots = document.createElement("span");
    dots.className = "dots";
    dots.setAttribute("aria-hidden", "true");
    dots.append(
      document.createElement("span"),
      document.createElement("span"),
      document.createElement("span"),
    );

    const label = document.createElement("span");
    label.textContent = "Pensando… buscando en los documentos de la cohorte";

    box.append(dots, label);
    dinamico.appendChild(box);
  }

  function renderizarRespuesta(textoSeguro, entrada) {
    dinamico.replaceChildren();
    dinamico.appendChild(crearBurbujaPregunta(textoSeguro));

    const divA = document.createElement("div");
    divA.className = "a";

    const pResp = document.createElement("p");
    pResp.textContent = entrada.respuesta;

    const pFuente = document.createElement("p");
    pFuente.className = "fuente";
    pFuente.append("Fuente: ");

    const enlace = document.createElement("a");
    enlace.href = "#fuente-documento";
    enlace.className = "link-fuente";
    enlace.textContent = entrada.fuente;
    pFuente.appendChild(enlace);

    const pAviso = document.createElement("p");
    pAviso.className = "ia-aviso";
    pAviso.textContent = aviso([entrada.fuente]);

    const acciones = document.createElement("div");
    acciones.className = "acciones";

    const chipSi = document.createElement("button");
    chipSi.type = "button";
    chipSi.className = "chip";
    chipSi.setAttribute("aria-pressed", "false");
    chipSi.textContent = "👍 Me sirvió";

    const chipNo = document.createElement("button");
    chipNo.type = "button";
    chipNo.className = "chip";
    chipNo.setAttribute("aria-pressed", "false");
    chipNo.textContent = "👎 No es correcto";

    const chipCoach = document.createElement("button");
    chipCoach.type = "button";
    chipCoach.className = "chip btn-coach";
    chipCoach.textContent = "Hablar con un coach";

    acciones.append(chipSi, chipNo, chipCoach);
    divA.append(pResp, pFuente, pAviso, acciones);
    dinamico.appendChild(divA);
  }

  function renderizarNoSe(textoSeguro) {
    dinamico.replaceChildren();
    dinamico.appendChild(crearBurbujaPregunta(textoSeguro));

    const tarjeta = document.createElement("div");
    tarjeta.className = "err";
    tarjeta.setAttribute("role", "alert");

    const titulo = document.createElement("h3");
    titulo.textContent = "No encontré esa información";

    const desc = document.createElement("p");
    desc.textContent =
      "No tengo un documento que responda esto con seguridad, y no quiero inventar una respuesta.";

    const pAviso = document.createElement("p");
    pAviso.className = "ia-aviso err-text";
    pAviso.textContent = aviso([]);

    const acciones = document.createElement("div");
    acciones.className = "acciones";

    const btnRef = document.createElement("button");
    btnRef.type = "button";
    btnRef.className = "btn-sec btn-reformular";
    btnRef.textContent = "Reformular pregunta";

    const btnCoach = document.createElement("button");
    btnCoach.type = "button";
    btnCoach.className = "btn-primario btn-coach";
    btnCoach.textContent = "Hablar con un coach";

    acciones.append(btnRef, btnCoach);
    tarjeta.append(titulo, desc, pAviso, acciones);
    dinamico.appendChild(tarjeta);
  }

  // Procesamiento principal de la pregunta
  function procesarPregunta(textoCrudo) {
    const limpio = textoCrudo.trim();
    if (!limpio) return;

    clearTimeout(temporizadorRespuesta);
    bannerCoach.hidden = true;
    ultimaPregunta = limpio;

    // 1. Proteger datos personales antes de mostrar o procesar
    const textoProtegido = protegerDatos(limpio);
    activarEstado("dinamico");

    // 2. Verificar si requiere derivación humana inmediata
    if (requiereHumano(textoProtegido)) {
      renderizarDerivacion(textoProtegido);
      return;
    }

    // 3. Mostrar estado cargando (~1.2s) y buscar en base ficticia
    renderizarCargando(textoProtegido);

    temporizadorRespuesta = setTimeout(() => {
      const resultado = buscarEnBase(textoProtegido);
      if (resultado) {
        renderizarRespuesta(textoProtegido, resultado);
      } else {
        renderizarNoSe(textoProtegido);
      }
    }, 1200);
  }

  // Envío del formulario
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const valor = inputPregunta.value;
    inputPregunta.value = "";
    procesarPregunta(valor);
  });

  // Botones de preguntas sugeridas
  document.querySelectorAll(".sug").forEach((btnSug) => {
    btnSug.addEventListener("click", () => {
      inputPregunta.value = btnSug.dataset.q || btnSug.textContent;
      form.requestSubmit();
    });
  });

  // Delegación de eventos para botones dinámicos y estáticos del chat
  document.getElementById("vista-app").addEventListener("click", (e) => {
    const target = e.target;

    // Botón Hablar con un coach (en cualquier parte)
    if (target.closest(".btn-coach")) {
      mostrarAvisoCoach();
      return;
    }

    // Botón Reformular pregunta
    if (target.closest(".btn-reformular")) {
      limpiarDinamico();
      return;
    }

    // Botón Reintentar
    if (target.closest(".btn-reintentar")) {
      if (ultimaPregunta) {
        procesarPregunta(ultimaPregunta);
      } else {
        limpiarDinamico();
      }
      return;
    }

    // Chips de valoración 👍 / 👎
    const chip = target.closest(".chip[aria-pressed]");
    if (chip) {
      const contenedor = chip.parentElement;
      contenedor.querySelectorAll(".chip[aria-pressed]").forEach((c) => {
        c.setAttribute("aria-pressed", String(c === chip));
      });
      return;
    }

    // Enlaces simulados de fuentes
    if (target.closest(".link-fuente")) {
      e.preventDefault();
      bannerCoach.textContent = `Vista previa simulada del documento: "${target.textContent}".`;
      bannerCoach.hidden = false;
    }
  });
  window.Brujula = {
    protegerDatos,
    requiereHumano,
    buscarEnBase,
    mostrarAvisoCoach,
    procesarPregunta,
  };
});
