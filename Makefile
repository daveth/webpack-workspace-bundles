BUILDER_DIR=./builder
CLI_PROJ_DIR=./cli-project

.PHONY:
all: install
	yarn --cwd=$(BUILDER_DIR) build
	yarn --cwd=$(CLI_PROJ_DIR) build

.PHONY:
install:
	yarn --cwd=$(BUILDER_DIR)
	yarn --cwd=$(CLI_PROJ_DIR)

.PHONY:
clean:
	yarn --cwd=$(BUILDER_DIR) clean
	yarn --cwd=$(CLI_PROJ_DIR) clean
