NPM ?= npm
.PHONY: install dev dev-build build test test-integration icons backend desktop dist release clean
install:
	$(NPM) ci
dev:
	$(NPM) run desktop:dev
dev-build:
	$(NPM) run build
	$(NPM) run bundle:electron
	$(NPM) run desktop
build: icons backend
	$(NPM) run build
	$(NPM) run bundle:electron
test:
	$(NPM) test
test-integration:
	node scripts/smoke-embedded.mjs
	node scripts/smoke-plugins.mjs
icons:
	$(NPM) run icons
backend:
	$(NPM) run prepare:backend
desktop:
	$(NPM) run desktop
dist:
	$(NPM) run dist:dir
release:
	$(NPM) run dist -- --publish never
clean:
	rm -rf dist electron-dist release
