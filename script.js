document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registroForm");
  const selectVisita = document.getElementById("id_visita");
  const cuposIndicador = document.getElementById("cupos-indicador");
  const qrMount = document.getElementById("qrMount");
  const preview = document.getElementById("preview");
  const btnDescargar = document.getElementById("btnDescargar");
  const btnImprimir = document.getElementById("btnImprimir");
  const feedback = document.getElementById("mensajeFeedback");

  const API_URL = window.API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "/api" : null);
  let qrInstance = null;
  let hasQr = false;

  // 1. Cargar visitas activas desde el servidor al iniciar
  const cargarVisitas = async () => {
    if (!API_URL) {
      selectVisita.innerHTML = '<option value="">Backend no disponible en GitHub Pages</option>';
      return;
    }

    try {
      const response = await fetch(`${API_URL}/visitas`);
      const visitas = await response.json();

      selectVisita.innerHTML = '<option value="">-- Selecciona una fábrica / destino --</option>';
      
      visitas.forEach(visita => {
        const option = document.createElement("option");
        option.value = visita.id_visita;
        option.textContent = `${visita.empresa} (${visita.fecha})`;
        selectVisita.appendChild(option);
      });
    } catch (error) {
      console.error("Error cargando visitas:", error);
      selectVisita.innerHTML = '<option value="">Error al cargar visitas del servidor</option>';
    }
  };

  // 2. Monitorear cambios en el menú para mostrar cupos restantes en tiempo real
  selectVisita.addEventListener("change", async (e) => {
    const idVisita = e.target.value;
    if (!idVisita) {
      cuposIndicador.style.display = "none";
      return;
    }

    if (!API_URL) {
      cuposIndicador.style.display = "none";
      return;
    }

    try {
      const response = await fetch(`${API_URL}/visitas/${idVisita}/cupo`);
      const data = await response.json();

      cuposIndicador.style.display = "flex";
      if (data.disponibles <= 0) {
        cuposIndicador.className = "cupos-banner danger";
        cuposIndicador.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Cupos Agotados (Límite: ${data.cupo_maximo})`;
      } else {
        cuposIndicador.className = "cupos-banner";
        cuposIndicador.innerHTML = `<i class="fa-solid fa-circle-info"></i> Quedan <strong>${data.disponibles} de ${data.cupo_maximo}</strong> lugares disponibles.`;
      }
    } catch (error) {
      console.error("Error al consultar cupo:", error);
    }
  });

  // 3. Procesar el envío del Formulario (Registro + Generación del QR Único)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!API_URL) {
      setFeedback("El registro requiere el backend. En GitHub Pages solo se sirve la interfaz.", "error");
      return;
    }

    const payload = {
      nombre: document.getElementById("nombre").value.trim(),
      matricula: document.getElementById("matricula").value.trim(),
      facultad: document.getElementById("facultad").value.trim(),
      carrera: document.getElementById("carrera").value.trim(),
      id_visita: selectVisita.value
    };

    // Mensaje de carga
    setFeedback("Procesando tu registro en la base de datos...", "info");
    qrMount.innerHTML = `
      <div class="hacker-loader">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <span>Guardando en base de datos...</span>
      </div>
    `;

    try {
      const response = await fetch(`${API_URL}/registrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al realizar el registro.");
      }

      // Registro exitoso: Generar QR institucional con el Token único retornado
      setFeedback("¡Pase de acceso generado con éxito!", "success");
      generarPaseQR(result.id_registro);

    } catch (err) {
      setFeedback(err.message, "error");
      qrMount.innerHTML = `
        <i class="fa-solid fa-circle-xmark placeholder-icon" style="color: #e53e3e;"></i>
        <p>No se pudo generar el pase. Verifica las restricciones de cupo.</p>
      `;
    }
  });

  const generarPaseQR = (textoToken) => {
    qrMount.innerHTML = "";
    preview.classList.remove("empty");
    preview.classList.add("ready");

    const canvas = document.createElement("canvas");
    canvas.width = 250;
    canvas.height = 250;
    qrMount.appendChild(canvas);

    qrInstance = new QRious({
      element: canvas,
      value: textoToken,
      size: 250,
      level: "H" // Protección alta contra fallos de escaneo
    });

    hasQr = true;
    btnDescargar.disabled = false;
    btnImprimir.disabled = false;
  };

  const setFeedback = (msg, status) => {
    feedback.textContent = msg;
    feedback.style.display = "block";
    feedback.className = `message message--${status}`;
  };

  // Descarga del canvas como imagen de pase
  btnDescargar.addEventListener("click", () => {
    if (!hasQr) return;
    const canvas = qrMount.querySelector("canvas");
    const link = document.createElement("a");
    link.download = `Pase-Acceso-UAdeC.png`;
    link.href = canvas.toDataURL();
    link.click();
  });

  // Imprimir el QR generado
  btnImprimir.addEventListener("click", () => {
    if (hasQr) window.print();
  });

  // Cargar las visitas al entrar
  cargarVisitas();
});
