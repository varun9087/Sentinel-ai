.PHONY: setup migrate test-backend test-frontend test run-backend run-frontend build-frontend docker-up docker-down

setup:
	python -m venv venv
	./venv/bin/pip install -r backend/requirements.txt
	./venv/bin/pip install -e sdk
	cd frontend && npm install

migrate:
	alembic upgrade head

test-backend:
	pytest -v tests/backend

test-frontend:
	cd frontend && npm test

test: test-backend test-frontend

run-backend:
	uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

run-frontend:
	cd frontend && npm run dev

build-frontend:
	cd frontend && npm run build

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down
