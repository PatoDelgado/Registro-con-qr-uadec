document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("qrForm");
  const preview = document.getElementById("qrPreview");
  const message = document.getElementById("formMessage");
  const btnDescargar = document.getElementById("btnDescargar");
  const btnImprimir = document.getElementById("btnImprimir");
  const btnLimpiar = document.getElementById("btnLimpiar");
  let qrMount = document.getElementById("qrMount");
  let qrCanvas = null;
  let qrInstance = null;

  const inputs = {
    nombre: document.getElementById("nombre"),
    matricula: document.getElementById("matricula"),
    facultad: document.getElementById("facultad"),
    carrera: document.getElementById("carrera"),
    empresa: document.getElementById("empresa"),
  };

  const errorNodes = new Map(
    [...document.querySelectorAll("[data-error-for]")].map((node) => [node.dataset.errorFor, node])
  );

  let hasQr = false;

  const trimValue = (value) => value.replace(/\s+/g, " ").trim();

  const setMessage = (text, type) => {
    message.className = `message show ${type}`;
    message.textContent = text;
  };

  const clearMessage = () => {
    message.className = "message";
    message.textContent = "";
  };

  const setFieldState = (name, state, text = "") => {
    const field = document.getElementById(name).closest(".field");
    field.classList.remove("is-valid", "is-invalid");

    if (state) {
      field.classList.add(state);
    }

    const errorNode = errorNodes.get(name);
    if (errorNode) {
      errorNode.textContent = state === "is-invalid" ? text : "";
    }
  };

  const updateCounter = (input) => {
    const counter = document.querySelector(`[data-counter-for="${input.id}"]`);
    if (!counter || !input.maxLength) return;

    counter.textContent = `${trimValue(input.value).length}/${input.maxLength}`;
  };

  const updateAllCounters = () => {
    Object.values(inputs).forEach((input) => {
      updateCounter(input);
    });
  };

  const validateField = (name) => {
    const input = inputs[name];
    const value = trimValue(input.value);

    if (input.required && !value) {
      setFieldState(name, "is-invalid", "Este campo es obligatorio.");
      return false;
    }

    setFieldState(name, "is-valid");
    return true;
  };

  const validateForm = () => {
    clearMessage();

    const requiredFields = ["nombre", "matricula", "facultad", "carrera", "empresa"];
    return requiredFields.map(validateField).every(Boolean);
  };

  const buildQrText = () => {
    // El QR debe contener texto legible para cualquier lector de QR.
    const nombre = trimValue(inputs.nombre.value);
    const matricula = trimValue(inputs.matricula.value);
    const facultad = trimValue(inputs.facultad.value);
    const carrera = trimValue(inputs.carrera.value);
    const empresa = trimValue(inputs.empresa.value);

    const lines = [
      "UNIVERSIDAD AUTÓNOMA DE COAHUILA",
      "",
      `Nombre: ${nombre}`,
      `Matrícula: ${matricula}`,
      `Facultad: ${facultad}`,
      `Carrera: ${carrera}`,
      `Empresa: ${empresa}`,
    ];

    return lines.join("\n");
  };

  const getQrCanvas = () => qrCanvas;

  const ensurePreviewIsVisible = () => {
    preview.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const generateQr = (text) => {
    qrMount.innerHTML = "";
    preview.classList.remove("empty");
    preview.classList.add("ready");
    hasQr = false;
    btnDescargar.disabled = true;
    btnImprimir.disabled = true;

    try {
      qrCanvas = document.createElement("canvas");
      qrCanvas.width = 280;
      qrCanvas.height = 280;
      qrMount.appendChild(qrCanvas);

      qrInstance = new QRious({
        element: qrCanvas,
        value: text,
        size: 280,
        level: "L",
        background: "#ffffff",
        foreground: "#0e1b3d",
      });

      window.setTimeout(() => {
        const rendered = qrMount.querySelector("canvas");
        if (!rendered) {
          setMessage("La vista previa no pudo renderizarse. Revisa que QRious esté cargado correctamente.", "error");
          return;
        }

        hasQr = true;
        btnDescargar.disabled = false;
        btnImprimir.disabled = false;
      }, 0);
    } catch (error) {
      console.error(error);
      setMessage("No se pudo generar la vista previa del QR.", "error");
    }
  };

  const downloadQr = () => {
    if (!hasQr) return;

    const canvas = getQrCanvas();
    const fileName = `QR-UADEC-${Date.now()}.png`;

    const triggerDownload = (dataUrl) => {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage("QR descargado correctamente en formato PNG.", "success");
    };

    if (canvas) {
      triggerDownload(canvas.toDataURL("image/png"));
      return;
    }

    setMessage("No se encontró el canvas del QR para descargar.", "error");
  };

  const printQr = () => {
    if (!hasQr) return;
    window.print();
  };

  const resetPreview = () => {
    qrMount.innerHTML = "";
    preview.classList.remove("ready");
    preview.classList.add("empty");
    hasQr = false;
    qrCanvas = null;
    qrInstance = null;
    btnDescargar.disabled = true;
    btnImprimir.disabled = true;
  };

  const clearForm = () => {
    form.reset();
    Object.keys(inputs).forEach((name) => setFieldState(name, ""));
    updateAllCounters();
    clearMessage();
    resetPreview();
  };

  Object.values(inputs).forEach((input) => {
    input.addEventListener("input", () => {
      updateCounter(input);
      clearMessage();
      if (input.value.trim()) {
        validateField(input.id);
      } else {
        setFieldState(input.id, "");
      }
    });

    input.addEventListener("blur", () => {
      validateField(input.id);
      updateCounter(input);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!validateForm()) {
      setMessage("Revisa los campos resaltados antes de generar el QR.", "error");
      return;
    }

    const qrText = buildQrText();
    generateQr(qrText);
  });

  btnDescargar.addEventListener("click", downloadQr);
  btnImprimir.addEventListener("click", printQr);
  btnLimpiar.addEventListener("click", clearForm);

  updateAllCounters();
  resetPreview();
});
