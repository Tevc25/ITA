SLS ?= npx serverless
STAGE ?= local
FUNCTION ?= processNotificationQueue
EVENT ?= event.json
UI_PORT ?= 4173

.PHONY: install offline deploy remove logs invoke print ui reset-local

install:
	npm install

offline:
	$(SLS) offline --stage $(STAGE)

deploy:
	$(SLS) deploy --stage $(STAGE)

remove:
	$(SLS) remove --stage $(STAGE)

logs:
	$(SLS) logs -f $(FUNCTION) --stage $(STAGE) --tail

invoke:
	$(SLS) invoke local -f $(FUNCTION) --path $(EVENT) --stage $(STAGE)

print:
	$(SLS) print --stage $(STAGE)

ui:
	cd web-ui && python3 -m http.server $(UI_PORT)

reset-local:
	rm -f data/local-db.json
