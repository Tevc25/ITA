SLS ?= npx serverless
STAGE ?= local
FUNCTION ?= processNotificationQueue
EVENT ?= event.json

.PHONY: install offline deploy remove logs invoke print

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
