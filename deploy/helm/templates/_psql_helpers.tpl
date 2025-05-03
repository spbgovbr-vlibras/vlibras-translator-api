{{- define "tradapiGetPostgresDatabase" -}}
{{- if and .Values.global .Values.global.postgresql .Values.global.postgresql.dbName (not .Values.externalServices.tradapi.postgresql.dbName) }}
  {{- .Values.global.postgresql.dbName -}}
{{- else if .Values.externalServices.tradapi.postgresql.dbName -}}``
  {{- .Values.externalServices.tradapi.postgresql.dbName -}}
{{- else if .Values.postgresql.auth.database -}}
  {{- .Values.postgresql.auth.database -}}
{{- else -}}
  {{- "default-db" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetPostgresUsername" -}}
{{- if and .Values.global .Values.global.postgresql .Values.global.postgresql.username (not .Values.externalServices.tradapi.postgresql.username) }}
  {{- .Values.global.postgresql.username -}}
{{- else if .Values.externalServices.tradapi.postgresql.username -}}
  {{- .Values.externalServices.tradapi.postgresql.username -}}
{{- else if .Values.postgresql.auth.username -}}
  {{- .Values.postgresql.auth.username -}}
{{- else -}}
  {{- "default-user" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetPostgresPassword" -}}
{{- if and .Values.global .Values.global.postgresql .Values.global.postgresql.password (not .Values.externalServices.tradapi.postgresql.password) }}
  {{- .Values.global.postgresql.password -}}
{{- else if .Values.externalServices.tradapi.postgresql.password -}}
  {{- .Values.externalServices.tradapi.postgresql.password -}}
{{- else if .Values.postgresql.auth.password -}}
  {{- .Values.postgresql.auth.password -}}
{{- else -}}
  {{- "default-password" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetPostgresHost" -}}
{{- if and .Values.global .Values.global.postgresql .Values.global.postgresql.host (not .Values.externalServices.tradapi.postgresql.host) }}
  {{- .Values.global.postgresql.host -}}
{{- else if .Values.externalServices.tradapi.postgresql.host -}}
  {{- .Values.externalServices.tradapi.postgresql.host -}}
{{- else if .Values.postgresql.host -}}
  {{- .Values.postgresql.host -}}
{{- else -}}
  {{- "localhost" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetPostgresPort" -}}
{{- if and .Values.global .Values.global.postgresql .Values.global.postgresql.port (not .Values.externalServices.tradapi.postgresql.port) }}
  {{- .Values.global.postgresql.port | toString -}}
{{- else if .Values.externalServices.tradapi.postgresql.port -}}
  {{- .Values.externalServices.tradapi.postgresql.port | toString -}}
{{- else if .Values.postgresql.port -}}
  {{- .Values.postgresql.port | toString -}}
{{- else -}}
  {{- "5432" -}}
{{- end -}}
{{- end -}}

{{/*
Define the name of the redis secret to use.
*/}}
{{- define "tradapiGetPostgresSecretName" -}}
{{- if and .Values.global .Values.global.postgresql .Values.global.postgresql.existingSecrets (not .Values.externalServices.tradapi.postgresql.existingSecrets) }}
  {{- print .Values.global.postgresql.existingSecrets }}
{{- else if .Values.externalServices.tradapi.postgresql.existingSecrets }}
  {{- print .Values.externalServices.tradapi.postgresql.existingSecrets }}
{{- else }}
  {{- print (include "tradapi.fullname" .) "-db-credentials" }}
{{- end }}
{{- end }}