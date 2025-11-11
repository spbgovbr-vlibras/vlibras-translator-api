{{- define "tradapiGetAmqpUsername" -}}
{{- if and .Values.global .Values.global.amqp .Values.global.amqp.username (not .Values.externalServices.tradapi.amqp.username) }}
  {{- .Values.global.amqp.username -}}
{{- else if .Values.externalServices.tradapi.amqp.username -}}
  {{- .Values.externalServices.tradapi.amqp.username -}}
{{- else if .Values.rabbitmqha.rabbitmqUsername -}}
  {{- .Values.rabbitmqha.rabbitmqUsername -}}
{{- else -}}
  {{- "default-user" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetAmqpPassword" -}}
{{- if and .Values.global .Values.global.amqp .Values.global.amqp.password (not .Values.externalServices.tradapi.amqp.password) }}
  {{- .Values.global.amqp.password -}}
{{- else if .Values.externalServices.tradapi.amqp.password -}}
  {{- .Values.externalServices.tradapi.amqp.password -}}
{{- else if .Values.rabbitmqha.rabbitmqPassword -}}
  {{- .Values.rabbitmqha.rabbitmqPassword -}}
{{- else -}}
  {{- "default-password" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetAmqpHost" -}}
{{- if and .Values.global .Values.global.amqp .Values.global.amqp.host (not .Values.externalServices.tradapi.amqp.host) }}
  {{- .Values.global.amqp.host -}}
{{- else if .Values.externalServices.tradapi.amqp.host -}}
  {{- .Values.externalServices.tradapi.amqp.host -}}
{{- else if .Values.amqp.host -}}
  {{- .Values.amqp.host -}}
{{- else -}}
  {{- "localhost" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetAmqpPort" -}}
{{- if and .Values.global .Values.global.amqp .Values.global.amqp.port (not .Values.externalServices.tradapi.amqp.port) }}
  {{- .Values.global.amqp.port | toString -}}
{{- else if .Values.externalServices.tradapi.amqp.port -}}
  {{- .Values.externalServices.tradapi.amqp.port | toString -}}
{{- else if .Values.amqp.port -}}
  {{- .Values.amqp.port | toString -}}
{{- else -}}
  {{- "5432" -}}
{{- end -}}
{{- end -}}

{{/*
Define the name of the PostgreSQL secret to use.
*/}}
{{- define "tradapiGetAmqpSecretName" -}}
{{- if and .Values.global .Values.global.amqp .Values.global.amqp.existingSecrets (not .Values.externalServices.tradapi.amqp.existingSecrets) }}
  {{- print .Values.global.amqp.existingSecrets }}
{{- else if .Values.externalServices.tradapi.amqp.existingSecrets }}
  {{- print .Values.externalServices.tradapi.amqp.existingSecrets }}
{{- else }}
  {{- print (include "tradapi.fullname" .) "-amqp-credentials" }}
{{- end }}
{{- end }}