.PHONY: \
	all \
	shell build watch lint \
	server-start server-stop

define DOCKER_COMPOSE_RUN
	docker compose run \
		-it \
		--user=$$(id -u):$$(id -g) \
		--remove-orphans \
		--service-ports \
		$1 $2
endef

define DOCKER_COMPOSE_UP
	docker compose up \
		--remove-orphans \
		$1
endef

all: watch

# node
shell:
	$(call DOCKER_COMPOSE_RUN,node,/bin/bash)

build:
	$(call DOCKER_COMPOSE_RUN,node,npm run build)

watch:
	$(call DOCKER_COMPOSE_RUN,node,npm run watch)

lint:
	$(call DOCKER_COMPOSE_RUN,node,npm run lint)

# nginx
server-start:
	$(call DOCKER_COMPOSE_UP,-d nginx)

server-stop:
	docker compose down nginx
