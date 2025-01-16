REPORTER = dot
MOCHA_OPTS= --check-leaks

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--check-leaks \
		$(MOCHA_OPTS)
	@./node_modules/.bin/jshint . --exclude node_modules

check: test

.PHONY: test
