backend
|-- .env
|-- .gitignore
|-- .prettierrc
|-- README.md
|-- eslint.config.mjs
|-- nest-cli.json
|-- package-lock.json
|-- package.json
|-- tsconfig.build.json
|-- tsconfig.json
|-- src
| |-- app.controller.spec.ts
| |-- app.controller.ts
| |-- app.module.ts
| |-- app.service.ts
| |-- main.ts
| |-- auth
| | |-- auth.controller.spec.ts
| | |-- auth.controller.ts
| | |-- auth.module.ts
| | |-- auth.service.spec.ts
| | |-- auth.service.ts
| | |-- decorators
| | | |-- public.decorator.ts
| | | |-- roles.decorator.ts
| | |-- guards
| | | |-- auth.guard.ts
| | | |-- roles.guard.ts
| |-- common
| | |-- Roles.ts
| |-- dto
| | |-- Auth
| | | |-- loginUser.dto.ts
| | | |-- registerUser.dto.ts
| | | |-- resetPassword.dto.ts
| | | |-- send-otp.dto.ts
| | |-- email
| | | |-- create-template.dto.ts
| | | |-- send-email.dto.ts
| | | |-- send-otp.dto.ts
| |-- email
| | |-- email.module.ts
| | |-- email.service.spec.ts
| | |-- email.service.ts
| | |-- entities
| | | |-- email.schema.ts
| | | |-- verification.schema.ts
| |-- interceptors
| | |-- logging.interceptor.ts
| |-- socket
| | |-- socket.gateway.ts
| | |-- socket.module.ts
| |-- user
| | |-- user.module.ts
| | |-- user.service.spec.ts
| | |-- user.service.ts
| | |-- entities
| | | |-- registerUser.entity.ts
|-- test
| |-- app.e2e-spec.ts
| |-- jest-e2e.json
