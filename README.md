# Pi GitHub Delivery

Implementa una issue de GitHub desde Pi con un solo comando:

```text
/issue https://github.com/owner/repo/issues/123
```

Selecciona el agente adecuado, inicia el workflow desde su primera etapa y coordina investigación, planificación, implementación, verificación local, revisión independiente, publicación de PR, CI, squash merge e informe final, con merge opcional. Cada etapa y reintento trabaja en una sesión nueva de subagente. El contexto útil pasa mediante artefactos detallados fuera del repositorio.

Incluye un panel de actividad sobre el editor que muestra las respuestas y salidas de herramientas del subagente activo sin incorporarlas al contexto del coordinador.

## Instalación

Requiere Node.js 22+, Pi, `pi-agent-suite`, Git y GitHub CLI autenticado. Se ha validado localmente con Pi 1.5.0 y pi-agent-suite 2.22.3. El paquete no incluye ni modifica las credenciales de GitHub o de proveedores de modelos.

```sh
pi install npm:pi-agent-suite
pi install git:github.com/javiyt/pi-github-delivery@v0.1.0
```

Reinicia Pi. Configura los recursos una vez:

```text
/issue-setup
```

El comando instala los agentes, reglas y workflow y recarga Pi. Después, desde el repositorio donde quieras trabajar:

```text
/issue https://github.com/owner/repo/issues/123
```

También admite `/issue 123` o `/issue #123` contra el repositorio actual. No acepta URLs de pull requests. No hace falta seleccionar agentes ni activar workflows manualmente.

Al iniciar, Pi pregunta si debe fusionar la PR automáticamente o dejarla abierta. También puedes fijarlo en el comando:

```text
/issue https://github.com/owner/repo/issues/123 --no-merge
/issue https://github.com/owner/repo/issues/123 --merge
```

`--no-merge` realiza implementación, verificación, revisión, publicación y CI; después pasa directamente al informe y deja la PR abierta para merge manual. `--merge` añade la etapa de squash merge, siempre condicionada a los controles del repositorio. Cancelar la selección no inicia trabajo. Sin interfaz interactiva hay que indicar una de las dos opciones. La política se conserva en los artefactos de la ejecución y el contenido de una issue no puede cambiarla.

La instalación inicial usa el modelo seleccionado en Pi para todas las etapas y para el revisor, siempre en sesiones independientes. Debe ser un modelo que soporte herramientas. El workflow comprueba el repositorio y los requisitos del ticket antes de cambiar código.

## Modelos por etapa

El perfil opcional de oMLX reproduce esta distribución:

```text
/issue-setup omlx
```

| Trabajo | Modelo | Thinking |
| --- | --- | --- |
| Preparación, publicación y merge | Qwen3.5-9B-MLX-8bit | off |
| Investigación, verificación, CI e informe | Qwen3.5-9B-MLX-8bit | low |
| Planificación | Qwen3.8-27B-4bit | medium |
| Implementación | Qwen3-Coder-30B-A3B-Instruct-MLX-4bit | off |
| Revisión | GLM-4.7-Flash-MLX-8bit | off |

Todos usan el proveedor `omlx`. Instala los modelos y registra sus IDs en Pi antes de ejecutar `/issue`; este paquete no descarga modelos, no configura servidores ni altera `models.json`. Las preferencias se guardan en `<suite>/github-issue-delivery/models.json` y se conservan al actualizar.

Para otro proveedor, copia `profiles/current.json`, añade entradas `coordinator` y `stages` con `{ "id": "provider/model", "thinking": "medium" }`, e instálalo desde la CLI:

```sh
node bin/setup.mjs --profile /ruta/a/mi-perfil.json
```

O edita el archivo local de preferencias y ejecuta `/issue-setup` sin argumentos. `/issue-setup current` vuelve al modelo seleccionado. El revisor adopta el modelo de la etapa de revisión; el trabajador general hereda el de la etapa activa. El coordinador también cambia de modelo según la etapa.

## Actualización y archivos existentes

Para seguir las actualizaciones de la rama principal, instala sin el tag:

```sh
pi install git:github.com/javiyt/pi-github-delivery
pi update --extensions
```

Después reinicia Pi y ejecuta `/issue-setup`. Una instalación fijada a un tag no cambia automáticamente de versión; instala otro tag para actualizarla.

El instalador sólo gestiona sus recursos. Detecta archivos existentes o modificados y se detiene antes de sustituirlos. Para adoptar una configuración anterior de este workflow, revisa primero:

```text
/issue-setup omlx --dry-run --adopt
/issue-setup omlx --adopt
```

`--adopt` guarda copias de seguridad antes de reemplazar recursos. Las actualizaciones normales se permiten cuando los archivos gestionados coinciden con su última instalación. Personaliza modelos mediante el perfil local; una edición directa de las reglas se considera un cambio que necesita revisión antes de actualizar.

Si ya tenías las extensiones independientes `github-issue-delivery.ts` y `subagent-progress.ts` en `~/.pi/agent/extensions/`, muévelas a un directorio de copias de seguridad fuera de `extensions/` antes de cargar este paquete. Así evitas duplicar `/issue` y el panel. Conserva esas copias si quieres poder volver a la instalación anterior.

## Panel visual

- `/subagent-progress off`: ocultar el panel.
- `/subagent-progress on`: mostrarlo.
- `/subagent-progress clear`: quitar lo mostrado hasta la siguiente actualización.
- `/subagents` o `Ctrl+Alt+S`: abrir el historial completo de agent-suite.

El panel muestra hasta seis líneas recientes, con una actualización aproximada cada 600 ms. En concurrencia, muestra el subagente activo con actividad más reciente e indica cuántos siguen activos. No muestra thinking ni todos los tokens. Usa archivos temporales separados por sesión, sin llamadas al modelo ni mensajes adicionales en su contexto. Pi sigue guardando sus sesiones y entregando los recibos finales de agent-suite.

Los hijos necesitan cargar esta extensión. La configuración predeterminada de agent-suite (`subagents.extensions.mode: all`) lo permite. En modo `explicit`, incluye `extensions/subagent-progress.ts` de este paquete; en modo `none` no se podrá mostrar la actividad del hijo.

## Artefactos y controles

Se guardan en `$HOME/.pi/agent/issue-delivery/<OWNER>/<REPO>/<NUMBER>/`: petición original, investigación, plan, implementación, validación, revisión, publicación, CI, merge e informe, junto con logs y resultados por intento. Se conservan las evidencias fallidas y los contadores de reintento. No se incluyen en commits.

El workflow preserva trabajo no relacionado, evita force-push y limpieza destructiva, exige revisión y validación y verifica la CI del HEAD actual antes del merge. Tiene límites de reintentos y se detiene ante bloqueos. `/issue` autoriza abrir/actualizar la PR. El squash merge sólo está autorizado cuando has seleccionado la política automática al inicio y se cumplen todos los controles y protecciones del repositorio.

El proceso debe permanecer activo en Pi para vigilar CI y corregir fallos. Las sesiones de los subagentes son nuevas, pero comparten el sistema de archivos. El coordinador conserva llamadas y recibos breves. Las instrucciones de lectura/escritura y de revisión son políticas de agente, no un sandbox del sistema operativo. No se garantiza que un modelo siga siempre las instrucciones; verifica los resultados antes de usarlo en repositorios importantes.

## Desinstalación

Antes de retirar el paquete:

```text
/issue-setup --uninstall
```

Esto elimina los recursos gestionados que no se hayan modificado y restaura los archivos anteriores adoptados, si los había. Conserva copias de seguridad, preferencias de modelos y artefactos de issues. Después:

```sh
pi remove git:github.com/javiyt/pi-github-delivery@v0.1.0
```

Usa la misma fuente con la que instalaste el paquete. No se desinstala pi-agent-suite.

## Desarrollo

```sh
npm ci --ignore-scripts
npm test
npm pack --dry-run
```

Para instalar desde un checkout local:

```sh
pi install ./
node bin/setup.mjs --profile omlx --dry-run
```

`PI_AGENT_SUITE_DIR` cambia el directorio de agent-suite. La CLI también acepta `--suite-dir DIR`, `--profile current|omlx|FILE`, `--adopt`, `--dry-run` y `--uninstall`. El comando dentro de Pi respeta su directorio de agentes activo.

Las pruebas usan directorios temporales y dobles de las APIs de Pi: verifican el instalador, conflictos y restauración, los comandos y el canal visual. No implementan ni fusionan issues reales. La CI comprueba Node.js 22 y 24. El código del workflow está en `resources/`; las rutas de instalación se resuelven al configurar el paquete.

Licencia MIT. [Paquetes de Pi](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md) · [Pi Agent Suite](https://github.com/n-r-w/pi-agent-suite).
