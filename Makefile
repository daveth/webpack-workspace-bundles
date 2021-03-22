BUILDER_DIR=./manyfest
TEST_PROJ_DIR=./test-project

.PHONY:
all: dependencies
	yarn --cwd=$(BUILDER_DIR) build
	yarn --cwd=$(TEST_PROJ_DIR) build

.PHONY:
dependencies:
	yarn --cwd=$(BUILDER_DIR)
	yarn --cwd=$(TEST_PROJ_DIR)

.PHONY:
clean:
	yarn --cwd=$(BUILDER_DIR) clean
	yarn --cwd=$(TEST_PROJ_DIR) clean
