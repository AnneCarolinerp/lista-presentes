const cfg = window.APP_CONFIG || {};

const configured =
  cfg.SUPABASE_URL?.startsWith("https://") &&
  !cfg.SUPABASE_ANON_KEY?.startsWith("COLE_");

const db = configured
  ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
  : null;

let state = {
  gifts: [],
  reservations: [],
  messages: []
};

let tab = "gifts";

const login = document.querySelector("#loginView");
const panel = document.querySelector("#panelView");
const content = document.querySelector("#panelContent");
const title = document.querySelector("#panelTitle");
const newGift = document.querySelector("#newGift");
const modal = document.querySelector("#adminModal");
const toast = document.querySelector("#toast");


function notify(text, error = false) {
  toast.textContent = text;
  toast.style.background = error ? "#7c3f38" : "#263127";
  toast.hidden = false;

  setTimeout(() => {
    toast.hidden = true;
  }, 4500);
}


function esc(value = "") {
  return String(value).replace(
    /[&<>'"]/g,
    char =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[char]
  );
}


function setState(data) {
  state = {
    gifts: Array.isArray(data?.gifts) ? data.gifts : [],
    reservations: Array.isArray(data?.reservations)
      ? data.reservations
      : [],
    messages: Array.isArray(data?.messages)
      ? data.messages
      : []
  };
}


async function boot() {
  if (!db) {
    document.querySelector("#loginError").textContent =
      "Preencha o arquivo config.js primeiro.";
    return;
  }

  const {
    data: { session }
  } = await db.auth.getSession();

  session ? showPanel() : showLogin();
}


function showLogin() {
  login.hidden = false;
  panel.hidden = true;
}


async function showPanel() {
  const { data, error } = await db.rpc("admin_get_data");

  if (error) {
    await db.auth.signOut();
    showLogin();

    document.querySelector("#loginError").textContent =
      "Este usuário não está autorizado como administrador.";

    return;
  }

  login.hidden = true;
  panel.hidden = false;

  setState(data);
  draw();
}


document.querySelector("#loginForm").onsubmit = async event => {
  event.preventDefault();

  const form = new FormData(event.currentTarget);
  const errorEl = document.querySelector("#loginError");

  errorEl.textContent = "";

  const { error } = await db.auth.signInWithPassword({
    email: form.get("email"),
    password: form.get("password")
  });

  if (error) {
    errorEl.textContent = "E-mail ou senha inválidos.";
    return;
  }

  showPanel();
};


document.querySelector("#logout").onclick = async () => {
  await db.auth.signOut();
  showLogin();
};


document.querySelectorAll("aside [data-tab]").forEach(button => {
  button.onclick = () => {
    tab = button.dataset.tab;

    document
      .querySelectorAll("aside [data-tab]")
      .forEach(item => {
        item.classList.toggle("active", item === button);
      });

    draw();
  };
});


newGift.onclick = () => giftModal(null);


function draw() {
  title.textContent = {
    gifts: "Presentes",
    reservations: "Reservas",
    messages: "Mensagens"
  }[tab];

  newGift.hidden = tab !== "gifts";


  /* =========================
     PRESENTES
  ========================= */

  if (tab === "gifts") {
    content.innerHTML = `
      <div class="admin-notice">
        As alterações aparecem automaticamente na página pública.
      </div>

      <div class="admin-list">
        ${state.gifts
          .map(
            gift => `
            <article class="admin-row">

              <div class="admin-row-main">

                ${
                  gift.image_url
                    ? `
                      <img
                        class="preview-img"
                        src="${esc(gift.image_url)}"
                        alt=""
                      >
                    `
                    : ""
                }

                <div>

                  <span class="category">
                    ${esc(gift.category)}
                    ${gift.hidden ? " · OCULTO" : ""}
                  </span>

                  <h3>${esc(gift.name)}</h3>

                  <p>
                    ${gift.available} disponíveis ·
                    ${gift.reserved} reservados ·
                    ${gift.received} recebidos
                  </p>

                </div>

              </div>

              <div class="row-actions">

                <button data-edit="${gift.id}">
                  Editar
                </button>

                <button data-delete="${gift.id}">
                  Excluir
                </button>

              </div>

            </article>
          `
          )
          .join("")}
      </div>
    `;
  }


  /* =========================
     RESERVAS
  ========================= */

  if (tab === "reservations") {
    content.innerHTML = `
      <div class="admin-list">

        ${
          state.reservations.length
            ? state.reservations
                .map(reservation => {
                  const received =
                    reservation.reservation_status === "received";

                  return `
                    <article class="admin-row">

                      <div>

                        <span class="category">
                          ${new Date(
                            reservation.created_at
                          ).toLocaleDateString("pt-BR")}
                        </span>

                        <h3>
                          ${esc(reservation.gift_name)}
                        </h3>

                        <p>
                          <strong>
                            ${esc(reservation.name)}
                          </strong>

                          · ${reservation.quantity} unidade(s)

                          ${
                            reservation.phone
                              ? ` · ${esc(reservation.phone)}`
                              : ""
                          }
                        </p>

                        ${
                          received
                            ? `
                              <p class="reservation-status received">
                                RECEBIDO ✓
                              </p>
                            `
                            : `
                              <p class="reservation-status reserved">
                                RESERVADO
                              </p>
                            `
                        }

                        ${
                          reservation.message
                            ? `
                              <blockquote>
                                “${esc(reservation.message)}”
                              </blockquote>
                            `
                            : ""
                        }

                      </div>

                      <div class="row-actions">

                        ${
                          received
                            ? `
                              <button
                                data-unreceive="${reservation.id}"
                              >
                                Desmarcar recebido
                              </button>
                            `
                            : `
                              <button
                                data-receive="${reservation.id}"
                              >
                                Marcar recebido
                              </button>

                              <button
                                data-release="${reservation.id}"
                              >
                                Liberar reserva
                              </button>
                            `
                        }

                      </div>

                    </article>
                  `;
                })
                .join("")
            : `
              <div class="empty">
                Nenhuma reserva.
              </div>
            `
        }

      </div>
    `;
  }


  /* =========================
     MENSAGENS
  ========================= */

  if (tab === "messages") {
    content.innerHTML = `
      <div class="admin-list">

        ${
          state.messages.length
            ? state.messages
                .map(
                  message => `
                    <article class="admin-row">

                      <div>

                        <span class="category">
                          ${new Date(
                            message.created_at
                          ).toLocaleDateString("pt-BR")}
                        </span>

                        <h3>
                          ${esc(message.name)}
                        </h3>

                        <blockquote>
                          “${esc(message.message)}”
                        </blockquote>

                      </div>

                    </article>
                  `
                )
                .join("")
            : `
              <div class="empty">
                Nenhum recadinho.
              </div>
            `
        }

      </div>
    `;
  }


  bindActions();
}


function bindActions() {

  /* EDITAR PRESENTE */

  content.querySelectorAll("[data-edit]").forEach(button => {
    button.onclick = () => {
      const gift = state.gifts.find(
        gift => gift.id === Number(button.dataset.edit)
      );

      giftModal(gift);
    };
  });


  /* EXCLUIR PRESENTE */

  content.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = () => {
      const confirmed = confirm(
        "Excluir este presente e seus registros?"
      );

      if (!confirmed) return;

      run(
        "admin_delete_gift",
        {
          p_gift_id: Number(button.dataset.delete)
        },
        "Presente excluído."
      );
    };
  });


  /* MARCAR RECEBIDO */

  content.querySelectorAll("[data-receive]").forEach(button => {
    button.onclick = () => {
      run(
        "admin_update_reservation",
        {
          p_reservation_id: Number(button.dataset.receive),
          p_action: "received"
        },
        "Presente marcado como recebido."
      );
    };
  });


  /* DESMARCAR RECEBIDO */

  content.querySelectorAll("[data-unreceive]").forEach(button => {
    button.onclick = () => {
      run(
        "admin_update_reservation",
        {
          p_reservation_id: Number(button.dataset.unreceive),
          p_action: "reserved"
        },
        "Recebimento desmarcado."
      );
    };
  });


  /* LIBERAR RESERVA */

  content.querySelectorAll("[data-release]").forEach(button => {
    button.onclick = () => {
      const confirmed = confirm(
        "Deseja liberar esta reserva? O presente voltará a ficar disponível."
      );

      if (!confirmed) return;

      run(
        "admin_update_reservation",
        {
          p_reservation_id: Number(button.dataset.release),
          p_action: "release"
        },
        "Reserva liberada."
      );
    };
  });
}


function giftModal(gift) {
  const categories = [
    "Quarto",
    "Cozinha",
    "Sala",
    "Banheiro",
    "Lavanderia",
    "Organização",
    "Decoração",
    "Eletrodomésticos",
    "Outros"
  ];

  const currentImage = gift?.image_url || "";

  modal.innerHTML = `
    <div class="shade">

      <div class="modal admin-modal">

        <button class="close">×</button>

        <span class="eyebrow">
          ${gift ? "EDITAR" : "NOVO"}
        </span>

        <h2>
          ${gift ? "Editar presente" : "Adicionar presente"}
        </h2>

        <form
          id="giftForm"
          data-original-purchase-url="${esc(
            gift?.purchase_url || ""
          )}"
        >

          <input
            name="id"
            type="hidden"
            value="${gift?.id || ""}"
          >

          <label>
            Nome

            <input
              name="name"
              required
              maxlength="150"
              value="${esc(gift?.name || "")}"
            >
          </label>

          <div class="form-row">

            <label>
              Categoria

              <select name="category">

                ${categories
                  .map(
                    category => `
                      <option
                        ${
                          gift?.category === category
                            ? "selected"
                            : ""
                        }
                      >
                        ${category}
                      </option>
                    `
                  )
                  .join("")}

              </select>
            </label>

            <label>
              Quantidade desejada

              <input
                name="desired"
                type="number"
                min="1"
                max="50"
                value="${gift?.desired || 1}"
              >
            </label>

          </div>

          <label>
            Descrição

            <textarea
              name="description"
              rows="3"
              maxlength="500"
            >${esc(gift?.description || "")}</textarea>
          </label>

          <label>
            Link opcional de compra

            <input
              id="purchaseUrl"
              name="purchase_url"
              type="url"
              value="${esc(gift?.purchase_url || "")}"
              placeholder="https://..."
            >
          </label>

          <div class="auto-photo-row">

            <div
              id="autoPhotoPreview"
              class="auto-photo-preview"
            >

              ${
                currentImage
                  ? `
                    <img
                      src="${esc(currentImage)}"
                      alt="Prévia da foto do presente"
                    >
                  `
                  : `
                    <span>
                      Sem foto
                    </span>
                  `
              }

            </div>

            <div>

              <button
                id="fetchProductImage"
                class="link-button"
                type="button"
              >
                Buscar foto pelo link
              </button>

              <small
                id="autoPhotoStatus"
                class="auto-photo-status"
              >
                Ao colar um link, vou tentar puxar a foto do produto automaticamente.
              </small>

            </div>

          </div>

          <label>
            Foto manual
            <small>(opcional)</small>

            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            >

            <input
              name="image_url"
              type="hidden"
              value="${esc(currentImage)}"
            >

            <small class="field-help">
              Se a loja bloquear a busca automática ou você quiser outra imagem, envie a foto aqui.
            </small>

          </label>

          <div class="form-row">

            <label>
              Ordem

              <input
                name="sort_order"
                type="number"
                value="${gift?.sort_order || 0}"
              >
            </label>

            <label class="check">

              <input
                name="hidden"
                type="checkbox"
                ${gift?.hidden ? "checked" : ""}
              >

              Ocultar temporariamente

            </label>

          </div>

          <button
            class="btn primary"
            type="submit"
          >
            Salvar presente
          </button>

        </form>

      </div>

    </div>
  `;


  modal.querySelector(".close").onclick = () => {
    modal.innerHTML = "";
  };


  const form = modal.querySelector("form");

  const purchaseInput =
    modal.querySelector("#purchaseUrl");

  const fetchButton =
    modal.querySelector("#fetchProductImage");


  form.onsubmit = saveGift;


  fetchButton.onclick = () => {
    fetchProductImageForForm(form, true);
  };


  let timer;


  purchaseInput.addEventListener("input", () => {
    clearTimeout(timer);

    timer = setTimeout(() => {
      if (purchaseInput.value.trim()) {
        fetchProductImageForForm(form, false);
      }
    }, 850);
  });


  purchaseInput.addEventListener("paste", () => {
    clearTimeout(timer);

    timer = setTimeout(() => {
      if (purchaseInput.value.trim()) {
        fetchProductImageForForm(form, false);
      }
    }, 120);
  });


  modal
    .querySelector('input[name="image"]')
    .addEventListener("change", event => {

      const file = event.target.files?.[0];

      if (!file) return;

      const preview =
        modal.querySelector("#autoPhotoPreview");

      preview.innerHTML = `
        <img
          src="${URL.createObjectURL(file)}"
          alt="Prévia da foto enviada"
        >
      `;

      setAutoPhotoStatus(
        "Foto manual selecionada. Ela terá prioridade ao salvar.",
        "success"
      );
    });
}


function setAutoPhotoStatus(text, type = "") {
  const element =
    modal.querySelector("#autoPhotoStatus");

  if (!element) return;

  element.textContent = text;

  element.className =
    `auto-photo-status${type ? ` ${type}` : ""}`;
}


async function fetchProductImageForForm(
  form,
  showToast = false
) {
  const input =
    form.querySelector('[name="purchase_url"]');

  const hidden =
    form.querySelector('[name="image_url"]');

  const preview =
    form.querySelector("#autoPhotoPreview");

  const button =
    form.querySelector("#fetchProductImage");

  const url = input.value.trim();


  if (!url) return null;


  try {
    new URL(url);
  } catch {
    setAutoPhotoStatus(
      "Cole um link completo começando com http:// ou https://.",
      "error"
    );

    return null;
  }


  button.disabled = true;

  setAutoPhotoStatus(
    "Buscando a foto do produto…",
    "loading"
  );


  const { data, error } =
    await db.functions.invoke(
      "product-preview",
      {
        body: { url }
      }
    );


  button.disabled = false;


  if (
    error ||
    !data?.ok ||
    !data?.image_url
  ) {
    const message =
      data?.error ||
      "A loja não liberou uma foto que eu consiga usar automaticamente.";

    setAutoPhotoStatus(
      `${message} Você ainda pode enviar uma foto manualmente.`,
      "error"
    );

    if (showToast) {
      notify(message, true);
    }

    return null;
  }


  hidden.value = data.image_url;


  preview.innerHTML = `
    <img
      src="${esc(data.image_url)}"
      alt="Prévia da foto encontrada"
    >
  `;


  setAutoPhotoStatus(
    "Foto encontrada no site da loja e pronta para ser usada.",
    "success"
  );


  if (showToast) {
    notify("Foto do produto encontrada.");
  }


  return data.image_url;
}


async function saveGift(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  const button =
    form.querySelector(
      'button[type="submit"]'
    );


  button.disabled = true;
  button.textContent = "Salvando…";


  let imageUrl =
    data.get("image_url") || "";

  const file =
    data.get("image");

  const purchaseUrl =
    String(
      data.get("purchase_url") || ""
    ).trim();

  const originalPurchaseUrl =
    form.dataset.originalPurchaseUrl || "";


  if (file?.size) {

    const extension =
      file.name
        .split(".")
        .pop()
        .toLowerCase();

    const path =
      `presentes/${crypto.randomUUID()}.${extension}`;


    const { error } =
      await db.storage
        .from("gift-images")
        .upload(
          path,
          file,
          {
            contentType: file.type
          }
        );


    if (error) {
      notify(
        "Não foi possível enviar a foto.",
        true
      );

      button.disabled = false;
      button.textContent =
        "Salvar presente";

      return;
    }


    imageUrl =
      db.storage
        .from("gift-images")
        .getPublicUrl(path)
        .data.publicUrl;

  } else if (
    purchaseUrl &&
    (
      !imageUrl ||
      purchaseUrl !== originalPurchaseUrl
    )
  ) {

    const fetched =
      await fetchProductImageForForm(
        form,
        false
      );

    if (fetched) {
      imageUrl = fetched;
    }
  }


  await run(
    "admin_save_gift",
    {
      p_gift: {
        id: data.get("id")
          ? Number(data.get("id"))
          : null,

        name:
          data.get("name"),

        category:
          data.get("category"),

        description:
          data.get("description"),

        image_url:
          imageUrl,

        purchase_url:
          purchaseUrl,

        desired:
          Number(data.get("desired")),

        sort_order:
          Number(data.get("sort_order")),

        hidden:
          data.get("hidden") === "on"
      }
    },
    "Presente salvo."
  );


  modal.innerHTML = "";
}


async function run(
  functionName,
  args,
  successMessage = "Alteração salva."
) {
  const { data, error } =
    await db.rpc(
      functionName,
      args
    );


  if (
    error ||
    data?.ok === false
  ) {
    notify(
      data?.error ||
        "Não foi possível concluir.",
      true
    );

    return;
  }


  notify(successMessage);


  const fresh =
    await db.rpc(
      "admin_get_data"
    );


  if (fresh.error) {
    notify(
      "A alteração foi salva, mas não foi possível atualizar o painel.",
      true
    );

    return;
  }


  setState(fresh.data);

  draw();
}


boot();