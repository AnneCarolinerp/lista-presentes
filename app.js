const cfg = window.APP_CONFIG || {};

const configured =
  cfg.SUPABASE_URL?.startsWith("https://") &&
  !cfg.SUPABASE_ANON_KEY?.startsWith("COLE_");

const db = configured
  ? supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    )
  : null;

let gifts = [];
let category = "Todos";

const grid = document.querySelector("#giftGrid");
const filters = document.querySelector("#categoryFilters");
const only = document.querySelector("#onlyAvailable");
const toast = document.querySelector("#toast");
const modalRoot = document.querySelector("#modalRoot");


function notify(text, error = false) {
  toast.textContent = text;
  toast.style.background = error
    ? "#7c3f38"
    : "#263127";

  toast.hidden = false;

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 5000);
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


async function load() {
  if (!db) {
    grid.innerHTML = `
      <div class="empty">
        O site ainda precisa ser conectado ao banco.
        Consulte o arquivo LEIA-ME.md.
      </div>
    `;

    return;
  }

  const { data, error } =
    await db.rpc("get_gift_catalog");

  if (error) {
    grid.innerHTML = `
      <div class="empty">
        Não foi possível carregar a lista agora.
      </div>
    `;

    console.error(error);

    return;
  }

  gifts = data || [];

  drawFilters();
  draw();
}


function drawFilters() {
  const categories = [
    "Todos",
    ...new Set(
      gifts.map(gift => gift.category)
    )
  ];

  filters.innerHTML = categories
    .map(
      item => `
        <button
          class="${item === category ? "active" : ""}"
          data-cat="${esc(item)}"
        >
          ${esc(item)}
        </button>
      `
    )
    .join("");

  filters
    .querySelectorAll("button")
    .forEach(button => {
      button.onclick = () => {
        category = button.dataset.cat;

        drawFilters();
        draw();
      };
    });
}


function draw() {
  const list = gifts.filter(gift => {
    const matchesCategory =
      category === "Todos" ||
      gift.category === category;

    const matchesAvailability =
      !only.checked ||
      Number(gift.available) > 0;

    return (
      matchesCategory &&
      matchesAvailability
    );
  });


  if (!list.length) {
    grid.innerHTML = `
      <div class="empty">
        Nenhum presente disponível neste filtro.
      </div>
    `;

    return;
  }


  grid.innerHTML = list
    .map(gift => {

      const desired =
        Math.max(
          Number(gift.desired) || 1,
          1
        );

      const available =
        Math.max(
          Number(gift.available) || 0,
          0
        );

      const reserved =
        Math.max(
          Number(gift.reserved) || 0,
          0
        );

      const received =
        Math.max(
          Number(gift.received) || 0,
          0
        );


      /*
       * Só consideramos o presente totalmente recebido
       * quando todas as unidades desejadas já foram
       * marcadas como recebidas.
       *
       * Exemplo:
       *
       * desired = 2
       * received = 1
       * available = 1
       *
       * Ainda não deve ficar cinza.
       */
      const fullyReceived =
        received >= desired;


      const completed =
        Math.min(
          desired,
          desired - available
        );


      const pct =
        Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (completed / desired) * 100
            )
          )
        );


      let statusText = "Disponível";

      if (fullyReceived) {
        statusText =
          "Presente recebido ❤️";
      } else if (available === 0) {
        statusText =
          "Presente escolhido ❤️";
      }


      let progressText;

      if (fullyReceived) {
        progressText =
          `Recebido — ${received} de ${desired}`;
      } else if (available > 0) {
        progressText =
          `Faltam ${available} de ${desired}`;
      } else {
        progressText =
          `Completo — ${desired} de ${desired}`;
      }


      return `
        <article
          class="card ${
            fullyReceived
              ? "received-card"
              : ""
          }"
        >

          <div class="photo">

            ${
              gift.image_url
                ? `
                  <img
                    src="${esc(gift.image_url)}"
                    alt="${esc(gift.name)}"
                  >
                `
                : `
                  <div class="placeholder">
                    <span>⌂</span>
                    <small>
                      FOTO EM BREVE
                    </small>
                  </div>
                `
            }

            <span class="status">
              ${statusText}
            </span>

          </div>


          <div class="card-body">

            <span class="category">
              ${esc(gift.category)}
            </span>

            <h3>
              ${esc(gift.name)}
            </h3>

            <p>
              ${esc(gift.description || "")}
            </p>


            <div class="progress">

              <div>

                <span>
                  ${progressText}
                </span>

                <span>
                  ${pct}%
                </span>

              </div>

              <i class="bar">
                <b
                  style="width:${pct}%"
                ></b>
              </i>

            </div>


            ${
              fullyReceived
                ? ""
                : `
                  <div class="actions">

                    ${
                      available > 0
                        ? `
                          <button
                            class="btn primary reserve"
                            data-id="${gift.id}"
                          >
                            Quero presentear
                          </button>
                        `
                        : ""
                    }

                    ${
                      gift.purchase_url
                        ? `
                          <a
                            class="btn secondary"
                            href="${esc(
                              gift.purchase_url
                            )}"
                            target="_blank"
                            rel="noopener"
                          >
                            Comprar online ↗
                          </a>
                        `
                        : ""
                    }

                  </div>

                  ${
                    !gift.purchase_url
                      ? `
                        <small class="hint">
                          Você pode procurar este item
                          na loja que preferir.
                        </small>
                      `
                      : ""
                  }
                `
            }

          </div>

        </article>
      `;
    })
    .join("");


  grid
    .querySelectorAll(".reserve")
    .forEach(button => {
      button.onclick = () =>
        openReserve(
          Number(button.dataset.id)
        );
    });
}


function openReserve(id) {
  const gift =
    gifts.find(
      item => item.id === id
    );

  if (!gift) return;


  modalRoot.innerHTML = `
    <div class="shade">

      <div
        class="modal"
        role="dialog"
        aria-modal="true"
      >

        <button
          class="close"
          aria-label="Fechar"
        >
          ×
        </button>

        <span class="eyebrow">
          QUE ALEGRIA!
        </span>

        <h2>
          Quero presentear
        </h2>

        <p>
          Você escolheu
          <strong>
            ${esc(gift.name)}
          </strong>.
          A compra pode ser feita onde preferir.
        </p>


        <form id="reserveForm">

          <input
            type="hidden"
            name="gift_id"
            value="${gift.id}"
          >


          <label>
            Seu nome

            <input
              name="name"
              maxlength="100"
              required
              autofocus
              placeholder="Digite seu nome"
            >
          </label>


          ${
            Number(gift.available) > 1
              ? `
                <label>
                  Quantidade

                  <select name="quantity">

                    ${Array.from(
                      {
                        length:
                          Number(
                            gift.available
                          )
                      },
                      (_, index) => `
                        <option>
                          ${index + 1}
                        </option>
                      `
                    ).join("")}

                  </select>

                </label>
              `
              : `
                <input
                  type="hidden"
                  name="quantity"
                  value="1"
                >
              `
          }


          <label>
            Telefone ou WhatsApp
            (opcional)

            <input
              name="phone"
              maxlength="40"
              placeholder="(00) 00000-0000"
            >
          </label>


          <label>
            Mensagem
            (opcional)

            <textarea
              name="message"
              maxlength="1000"
              rows="3"
              placeholder="Quer deixar um recadinho?"
            ></textarea>
          </label>


          <button
            class="btn primary"
            type="submit"
          >
            Confirmar reserva
          </button>

        </form>

      </div>

    </div>
  `;


  modalRoot
    .querySelector(".close")
    .onclick = closeModal;


  modalRoot
    .querySelector(".shade")
    .onclick = event => {

      if (
        event.target.classList.contains(
          "shade"
        )
      ) {
        closeModal();
      }
    };


  modalRoot
    .querySelector("form")
    .onsubmit = reserve;
}


function closeModal() {
  modalRoot.innerHTML = "";
}


function openMessageSuccess() {
  modalRoot.innerHTML = `
    <div class="shade">

      <div
        class="modal message-success"
        role="dialog"
        aria-modal="true"
        aria-labelledby="messageSuccessTitle"
      >

        <span
          class="success-heart"
          aria-hidden="true"
        >
          ❤️
        </span>

        <h2 id="messageSuccessTitle">
          Mensagem enviada!
        </h2>

        <p>
          Seu recadinho foi guardado
          com carinho. Muito obrigada!
        </p>

        <button
          class="btn primary"
          type="button"
        >
          Fechar
        </button>

      </div>

    </div>
  `;


  modalRoot
    .querySelector("button")
    .onclick = closeModal;
}


async function reserve(event) {
  event.preventDefault();

  const form =
    event.currentTarget;

  const data =
    new FormData(form);

  const button =
    form.querySelector("button");


  button.disabled = true;

  button.textContent =
    "Confirmando…";


  const {
    data: result,
    error
  } = await db.rpc(
    "reserve_gift",
    {
      p_gift_id:
        Number(
          data.get("gift_id")
        ),

      p_quantity:
        Number(
          data.get("quantity")
        ),

      p_name:
        data.get("name"),

      p_phone:
        data.get("phone") || "",

      p_message:
        data.get("message") || ""
    }
  );


  if (
    error ||
    !result?.ok
  ) {
    notify(
      result?.error ||
        "Este presente acabou de ser escolhido. Atualizei a disponibilidade.",
      true
    );

    closeModal();

    await load();

    return;
  }


  closeModal();


  notify(
    "Que carinho! ❤️ Seu presente foi reservado. Muito obrigada!"
  );


  await load();
}


document
  .querySelector("#messageForm")
  .onsubmit = async event => {

    event.preventDefault();


    if (!db) {
      return notify(
        "Configure o banco antes de enviar mensagens.",
        true
      );
    }


    const messageForm =
      event.currentTarget;

    const data =
      new FormData(messageForm);

    const button =
      messageForm.querySelector(
        "button"
      );


    button.disabled = true;


    const {
      data: result,
      error
    } = await db.rpc(
      "submit_message",
      {
        p_name:
          data.get("name"),

        p_message:
          data.get("message")
      }
    );


    button.disabled = false;


    if (
      error ||
      !result?.ok
    ) {
      return notify(
        "Não foi possível enviar o recadinho.",
        true
      );
    }


    messageForm.reset();

    openMessageSuccess();
  };


only.onchange = draw;

load();