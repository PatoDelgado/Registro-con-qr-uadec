document.addEventListener("DOMContentLoaded", () => {
  const adminKeyInput = document.getElementById("adminKey");
  const btnAdminLogin = document.getElementById("btnAdminLogin");
  const btnAdminLogout = document.getElementById("btnAdminLogout");
  const adminForm = document.getElementById("adminForm");
  const adminEmpresa = document.getElementById("adminEmpresa");
  const adminFecha = document.getElementById("adminFecha");
  const adminCupo = document.getElementById("adminCupo");
  const adminActivo = document.getElementById("adminActivo");
  const adminList = document.getElementById("adminList");
  const adminFeedback = document.getElementById("adminFeedback");
  const btnRefrescarAdmin = document.getElementById("btnRefrescarAdmin");

  const API_URL = window.API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "/api" : null);
  let adminKey = localStorage.getItem("adminKey") || "";

  const setAdminFeedback = (msg, status) => {
    adminFeedback.textContent = msg;
    adminFeedback.style.display = "block";
    adminFeedback.className = `message message--${status}`;
  };

  const getHeaders = (includeJson = true) => {
    const headers = {};
    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }
    if (adminKey) {
      headers["x-admin-key"] = adminKey;
    }
    return headers;
  };

  const renderAdminVisitas = (visitas) => {
    if (!visitas.length) {
      adminList.innerHTML = '<p class="admin-meta">No hay visitas registradas.</p>';
      return;
    }

    adminList.innerHTML = visitas.map((visita) => `
      <article class="admin-card">
        <div class="admin-card__top">
          <div class="admin-card__title">
            <strong>${visita.empresa}</strong>
            <span>${visita.fecha}</span>
          </div>
          <span class="admin-meta">${visita.activo ? "Activa" : "Inactiva"}</span>
        </div>
        <div class="admin-meta">
          ID ${visita.id_visita} · Cupo ${visita.cupo_maximo} · Registrados ${visita.registrados ?? 0} · Disponibles ${visita.disponibles ?? (visita.cupo_maximo - (visita.registrados ?? 0))}
        </div>
        <form class="admin-edit-form" data-id="${visita.id_visita}">
          <div class="form-row">
            <div class="form-group">
              <label>Empresa</label>
              <input type="text" name="empresa" value="${visita.empresa.replace(/"/g, "&quot;")}">
            </div>
            <div class="form-group">
              <label>Fecha</label>
              <input type="date" name="fecha" value="${visita.fecha}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Cupo</label>
              <input type="number" name="cupo_maximo" min="1" step="1" value="${visita.cupo_maximo}">
            </div>
            <label class="toggle-row" style="margin-top: 24px;">
              <input type="checkbox" name="activo" ${visita.activo ? "checked" : ""}>
              <span>Activa</span>
            </label>
          </div>
          <div class="admin-card__actions">
            <button class="btn btn--primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
            <button class="btn btn-secondary" type="button" data-action="excel" data-id="${visita.id_visita}">
              <i class="fa-solid fa-file-excel"></i> Excel
            </button>
            <button class="btn btn-secondary" type="button" data-action="toggle" data-id="${visita.id_visita}">
              <i class="fa-solid fa-power-off"></i> ${visita.activo ? "Desactivar" : "Activar"}
            </button>
            <button class="btn btn-secondary" type="button" data-action="delete" data-id="${visita.id_visita}">
              <i class="fa-solid fa-trash"></i> Eliminar
            </button>
          </div>
        </form>
      </article>
    `).join("");
  };

  const cargarAdminVisitas = async () => {
    if (!API_URL || !adminKey) return;

    try {
      const response = await fetch(`${API_URL}/admin/visitas`, {
        headers: getHeaders(false)
      });

      if (response.status === 401) {
        throw new Error("Clave de admin incorrecta.");
      }

      const visitas = await response.json();
      renderAdminVisitas(visitas);
    } catch (error) {
      adminList.innerHTML = "";
      setAdminFeedback(error.message || "No se pudieron cargar las visitas.", "error");
    }
  };

  if (adminKey) {
    adminKeyInput.value = adminKey;
    cargarAdminVisitas();
  }

  btnAdminLogin.addEventListener("click", () => {
    const value = adminKeyInput.value.trim();
    if (!value) {
      setAdminFeedback("Ingresa una clave de admin.", "error");
      return;
    }
    adminKey = value;
    localStorage.setItem("adminKey", adminKey);
    setAdminFeedback("Acceso de admin habilitado.", "success");
    cargarAdminVisitas();
  });

  btnAdminLogout.addEventListener("click", () => {
    adminKey = "";
    localStorage.removeItem("adminKey");
    adminKeyInput.value = "";
    adminList.innerHTML = "";
    setAdminFeedback("Sesión de admin cerrada.", "success");
  });

  btnRefrescarAdmin.addEventListener("click", cargarAdminVisitas);

  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!adminKey) {
      setAdminFeedback("Primero entra con la clave de admin.", "error");
      return;
    }

    const payload = {
      empresa: adminEmpresa.value.trim(),
      fecha: adminFecha.value,
      cupo_maximo: Number(adminCupo.value),
      activo: adminActivo.checked
    };

    try {
      const response = await fetch(`${API_URL}/admin/visitas`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "No se pudo crear la visita.");
      }
      setAdminFeedback("Visita creada con éxito.", "success");
      adminForm.reset();
      adminActivo.checked = true;
      cargarAdminVisitas();
    } catch (error) {
      setAdminFeedback(error.message, "error");
    }
  });

  adminList.addEventListener("submit", async (e) => {
    const formRow = e.target.closest(".admin-edit-form");
    if (!formRow) return;
    e.preventDefault();

    const id = formRow.dataset.id;
    const formData = new FormData(formRow);
    const payload = {
      empresa: formData.get("empresa"),
      fecha: formData.get("fecha"),
      cupo_maximo: Number(formData.get("cupo_maximo")),
      activo: formData.get("activo") === "on"
    };

    try {
      const response = await fetch(`${API_URL}/admin/visitas/${id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "No se pudo actualizar la visita.");
      }
      setAdminFeedback("Visita actualizada con éxito.", "success");
      cargarAdminVisitas();
    } catch (error) {
      setAdminFeedback(error.message, "error");
    }
  });

  adminList.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "delete") {
      if (!confirm("¿Eliminar esta visita? Esta acción no se puede deshacer.")) return;
      try {
        const response = await fetch(`${API_URL}/admin/visitas/${id}`, {
          method: "DELETE",
          headers: getHeaders(false)
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "No se pudo eliminar la visita.");
        }
        setAdminFeedback("Visita eliminada con éxito.", "success");
        cargarAdminVisitas();
      } catch (error) {
        setAdminFeedback(error.message, "error");
      }
    }

    if (action === "toggle") {
      const card = button.closest(".admin-edit-form");
      const activoInput = card.querySelector('input[name="activo"]');
      activoInput.checked = !activoInput.checked;
      card.requestSubmit();
    }

    if (action === "excel") {
      const link = document.createElement("a");
      link.href = `${API_URL}/admin/visitas/${id}/excel?admin_key=${encodeURIComponent(adminKey)}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  });
});
