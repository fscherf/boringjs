.PHONY: shell

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

shell:
	$(call DOCKER_COMPOSE_RUN,node,/bin/bash)
