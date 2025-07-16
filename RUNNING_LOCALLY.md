# Running AI Virtual Agent Locally

For local development, run the application backend and frontend by following these steps.

## Running the backend locally

### Create a python virtual environment

```shell
python3 -m venv venv && source venv/bin/activate && pip install -r backend/requirements.txt
```

### Forward following localhost ports to OpenShift Services
```shell
oc port-forward svc/pgvector 5432
oc port-forward svc/llamastack 8321
```

### Run using VSCode launch.json
Add this configuration to your `.vscode/launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "debug streamlit",
            "type": "debugpy",
            "request": "launch",
            "program": "<your path to>/redhat-blueprints/ai-virtual-assistant/venv/bin/uvicorn",
            "args": [
                "backend.main:app",
                "--reload"
            ],
            "env": {
                "DATABASE_URL": "postgresql+asyncpg://postgres:rag_password@localhost:5432/ai_virtual_assistant",
                "LLAMASTACK_URL": "http://localhost:8321"
            },
            "cwd": "${workspaceFolder}",
            "console": "integratedTerminal"
        }
    ]
}
```

## Running the UI locally

### Install dependencies (one time on first run)

```shell
cd frontend
npm install 
```

### Run the UI
```shell
npm run dev
```

### Launch UI
Navigate your browser to http://localhost:5173