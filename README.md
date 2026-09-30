# Biscuit Factory AI Assistant

**Your smart assistant for biscuits, orders and customer support**

A small, intermediate-level Flask application that sends customer questions to OpenRouter from the backend. It supplies editable sample biscuit catalog facts as context, preserves recent conversation history in the browser session, and presents an accessible responsive chat interface.

> **Sample data:** Product names, prices, ingredients, availability, and shelf life in `products.py` are illustrative only. Replace and verify them before using this for a real factory. No real business, contact, ordering, delivery, or factory information is included.

## Problem and objective

Customers should be able to ask a question in their own words without choosing a category. The assistant uses a live OpenRouter conversational model and the sample product catalog to answer product questions, explain when information is unknown, and handle general support enquiries without making up company facts.

## Features

- Natural language chat for product, ingredient, flavor, pack, order, complaint, and general questions.
- Relevant product context selected from `products.py` and explicit handling for a product not found in the catalog.
- Live OpenRouter connection check and model catalog discovery.
- Automatic model selection from the current text-output model catalog; optional model selector in the UI.
- Recent chat context kept in page memory and sent with each request; no accounts or permanent storage.
- Friendly handling for missing/invalid keys, rate limits, unavailable models, network timeouts, empty input, and malformed requests.
- Responsive UI with status, model, timestamps, typing feedback, clear/new chat, and copy response controls.
- No authentication and no database.

## Technology and architecture

- Frontend: HTML5, CSS3, vanilla JavaScript.
- Backend: Python and Flask.
- AI: OpenRouter REST API using `GET /api/v1/models` and `POST /api/v1/chat/completions`.
- Configuration/HTTP: `python-dotenv`, `requests`.

The browser talks only to Flask routes (`/api/status`, `/api/test`, `/api/models`, `/api/model`, `/api/chat`). Flask alone holds the OpenRouter key and calls `https://openrouter.ai/api/v1`. The chat route composes the system instructions, selected sample product facts, bounded recent history, and the latest user question. No secret is sent to the browser.

## Project structure

```text
biscuit_factory_chatbot/
├── app.py
├── products.py
├── requirements.txt
├── .env                 # local secret; ignored by Git
├── .gitignore
├── README.md
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

## Installation and configuration

Python 3.10+ is recommended.

```bash
cd biscuit_factory_chatbot
python -m venv .venv
# Windows PowerShell
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Edit `.env` and replace the placeholder with your own OpenRouter API key:

```dotenv
OPENROUTER_API_KEY=YOUR_NEW_OPENROUTER_API_KEY
```

The checked-in starter `.env` deliberately contains only a placeholder and is ignored by Git. Do not commit a real key. If you downloaded/copied the project, create `.env` from this example if needed.

## Run the app

```bash
python app.py
```

Open <http://127.0.0.1:5000>. On startup, the backend checks whether the key exists, fetches the model catalog, filters for text-output models, and picks a preferred conversational family from those currently returned. The first available fallback is used when no preferred family matches. Model catalogs change, so no model ID is hard-coded. Use the dropdown to select another currently returned model; selection is held in backend memory until the process restarts.

## API and model discovery

- `GET /api/status` provides browser-friendly connection state and the selected model.
- `GET /api/test` makes a safe authenticated `GET /api/v1/models` request and returns `{ "success": true/false, "message": "..." }` without returning secret details.
- `GET /api/models` returns current model IDs/names, context lengths, pricing metadata when listed, and provider derived from the model ID, plus the selected ID.
- `POST /api/model` selects an ID only if it exists in the current fetched catalog.
- `POST /api/chat` accepts `{ "message": "...", "history": [...] }` and returns `{ "success": true, "response": "..." }` on success.

Example API checks:

```bash
curl http://127.0.0.1:5000/api/test
curl http://127.0.0.1:5000/api/models
curl -X POST http://127.0.0.1:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Which chocolate biscuits are available?","history":[]}'
```

The app also checks model availability on page load. `GET /api/test` and `/api/models` can be called directly during setup.

## Edit product data

Change the `PRODUCTS` list in `products.py`. Each entry supports `name`, `category`, `flavor`, `pack_sizes`, `price`, `ingredients`, `availability`, and `shelf_life`. Replace all `Sample`/`XX` values with approved information, including exact pack prices if prices vary by size. The sample bot is instructed not to infer missing facts. Do not use sample ingredient data for allergy advice; customers should check current packaging.

Set verified contact, order, and delivery instructions in `SYSTEM_PROMPT` before deploying a real business assistant. Until then, the assistant says these procedures are not configured.

## Testing procedure and expected results

Run `python app.py`, visit the site, inspect the status/model dropdown, then use the following prompts. Responses depend on the currently selected model, but must stay within supplied facts and say when information is missing.

| Check | Expected result |
|---|---|
| `GET /api/test` with valid key | `success: true`; status becomes **AI Service Connected**. |
| `GET /api/models` with valid key | Current text-output model metadata and an automatically selected model. |
| `Hello` | Friendly greeting. |
| `What biscuits do you have?` | Catalog names, identified as sample data. |
| `Which chocolate biscuits are available?` | Chocolate Crunch sample record; do not claim real stock. |
| `What ingredients are used?` | Ask which product if unclear, or use the product established by conversation. |
| `What pack sizes are available?` | Use the current or prior product context and list only its catalog sizes. |
| `What is the price?` | Use the current product context; explain price is a placeholder if not configured. Never invent a numeric price. |
| `Do you accept bulk orders?` | Explain process/contact are not configured; do not invent them. |
| `I own a grocery store.` | Ask how to help with retailer ordering; do not invent a sales contact or terms. |
| `How can I contact the company?` | Clearly state verified contact information is not configured. |
| `I received a damaged packet.` | Polite response, ask for product/order details and issue; disclose support channel is not configured. |
| `I want to give feedback.` | Invite feedback; explain the official channel is not configured. |
| `Tell me about the factory.` | State company/factory details are unavailable. |
| Explicit question about a nonexistent product | “Sorry, I couldn't find that product in our current product list.” |
| Empty message | Frontend prevents sending; backend returns HTTP 400 and a friendly prompt if called directly. |

### Failure checks

| Scenario | Expected result |
|---|---|
| Missing key | Startup logs a safe warning; status disconnected; chat explains server configuration is needed. `/api/models` reports missing configuration. |
| Invalid key | API test fails with a generic message; chat says the configured key is invalid. No key or upstream body is returned. |
| Invalid/unavailable model | UI only submits models from the live list; a stale model returns a friendly “choose another” error and discovery is refreshed after a 404. |
| OpenRouter unavailable / network failure | Status/model discovery fails safely; chat reports temporary unavailability or timeout. |
| Rate limit (HTTP 429) | Chat asks user to retry shortly. |
| Malformed request / invalid API response | Friendly 400/502 JSON; no traceback exposed to the client. |

To check missing-key behavior, temporarily remove or blank the key in `.env`, restart Flask, and restore the valid key afterward. To exercise upstream failures reliably, use a local mock/stub in development; do not repeatedly send invalid credentials to a real account. A successful live API test and actual model responses require a valid key and network access.

## Troubleshooting

- **Disconnected / missing key:** confirm `.env` is beside `app.py`, the variable is exactly `OPENROUTER_API_KEY`, and restart Flask after edits.
- **Invalid key:** create/check the key in OpenRouter and replace it locally; never paste it into frontend files or share it in logs/screenshots.
- **No model list:** check network access, key status, and OpenRouter availability; the endpoint may be temporarily unreachable.
- **Model unavailable:** select another dropdown option. Restarting re-discovers current models.
- **429 or balance error:** retry later and check account limits/credits in OpenRouter.
- **No verified contact/order data:** edit the system prompt with approved company procedures and verified contact channels.
- **PowerShell virtualenv activation blocked:** use `python -m venv .venv`, then run `.venv\Scripts\python.exe -m pip install -r requirements.txt` and `.venv\Scripts\python.exe app.py`.

## Security practices

- The OpenRouter key is read from `.env` by Flask and is never returned to the browser.
- `.env` is listed in `.gitignore`; verify `git status` before committing.
- Upstream error bodies, keys, stack traces, and environment variables are not returned to chat clients.
- Inputs and history are length-limited; only user/assistant roles are accepted in history.
- No login, signup, authentication, OAuth, JWT, database, or permanent conversation store exists.
- For production, run behind HTTPS and a production WSGI server, set restrictive deployment/network policies, and use verified business data.

## Future enhancements

- Approved product catalog administration and verified pack-specific prices.
- Verified support, order, delivery, and retailer workflows.
- Stronger product matching and multilingual conversation support.
- Optional privacy-conscious conversation export and feedback review.
- Deployment hardening, request monitoring, and automated integration checks.
