.PHONY: install build test setup bootstrap proxy dev clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install

build: ## Compile TypeScript
	pnpm build

test: ## Run unit tests
	pnpm test

dev: ## Watch mode (recompile on change)
	pnpm dev

setup: install build ## Full setup: install, build, then run interactive setup
	pnpm setup

bootstrap: install build ## Two-step bootstrap: install, build, start approval flow
	pnpm bootstrap:start

bootstrap-finish: ## Finish pending bootstrap (poll for approval)
	pnpm bootstrap:finish

proxy: ## Start the MCP proxy (default port 3000)
	pnpm proxy

clean: ## Remove build artifacts
	rm -rf dist

all: install build test ## Install, build, and test
