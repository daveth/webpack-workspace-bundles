BUILDER_DIR=./builder
CLI_PROJ_DIR=./cli-project

.PHONY:
all:
	yarn --cwd=$(BUILDER_DIR) build
	yarn --cwd=$(CLI_PROJ_DIR) build

.PHONY:
clean:
	yarn --cwd=$(BUILDER_DIR) clean
	yarn --cwd=$(CLI_PROJ_DIR) clean
