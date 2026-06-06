# Dev convenience targets for the LUTs store monorepo.
# Backend = Django (port 8000), Frontend = Next.js (port 3000).

.PHONY: help backend-install backend-run frontend-install frontend-run dev test

help:
	@echo "Targets:"
	@echo "  backend-install   Create venv and install Python deps"
	@echo "  backend-run       Run Django dev server (:8000)"
	@echo "  frontend-install  Install Node deps"
	@echo "  frontend-run      Run Next.js dev server (:3000)"
	@echo "  test              Run backend test suite"

backend-install:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

backend-run:
	cd backend && . .venv/bin/activate && python manage.py migrate && python manage.py runserver

frontend-install:
	cd frontend && npm install

frontend-run:
	cd frontend && npm run dev

test:
	cd backend && . .venv/bin/activate && python manage.py test
