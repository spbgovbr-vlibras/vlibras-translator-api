{{- define "tradapiGetRedisCache" -}}
{{- if and .Values.global .Values.global.redis .Values.global.redis.cachename (not .Values.externalServices.tradapi.redis.cachename) }}
  {{- .Values.global.redis.cachename -}}
{{- else if .Values.externalServices.tradapi.redis.cachename -}}``
  {{- .Values.externalServices.tradapi.redis.cachename -}}
{{- else if .Values.redis.cachename -}}
  {{- .Values.redis.cachename -}}
{{- else -}}
  {{- "tradapi" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetRedisPassword" -}}
{{- if and .Values.global .Values.global.redis .Values.global.redis.password (not .Values.externalServices.tradapi.redis.password) }}
  {{- .Values.global.redis.password -}}
{{- else if .Values.externalServices.tradapi.redis.password -}}
  {{- .Values.externalServices.tradapi.redis.password -}}
{{- else if .Values.redis.password -}}
  {{- .Values.redis.password -}}
{{- else -}}
  {{- "default-password" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetRedisHost" -}}
{{- if and .Values.global .Values.global.redis .Values.global.redis.host (not .Values.externalServices.tradapi.redis.host) }}
  {{- .Values.global.redis.host -}}
{{- else if .Values.externalServices.tradapi.redis.host -}}
  {{- .Values.externalServices.tradapi.redis.host -}}
{{- else if .Values.redis.host -}}
  {{- .Values.redis.host -}}
{{- else -}}
  {{- "localhost" -}}
{{- end -}}
{{- end -}}

{{- define "tradapiGetRedisPort" -}}
{{- if and .Values.global .Values.global.redis .Values.global.redis.port (not .Values.externalServices.tradapi.redis.port) }}
  {{- .Values.global.redis.port | toString -}}
{{- else if .Values.externalServices.tradapi.redis.port -}}
  {{- .Values.externalServices.tradapi.redis.port | toString -}}
{{- else if .Values.redis.port -}}
  {{- .Values.redis.port | toString -}}
{{- else -}}
  {{- "6379" -}}
{{- end -}}
{{- end -}}

{{/*
Define the name of the redis secret to use.
*/}}
{{- define "tradapiGetRedisSecretName" -}}
{{- if and .Values.global .Values.global.redis .Values.global.redis.existingSecrets (not .Values.externalServices.tradapi.redis.existingSecrets) }}
  {{- print .Values.global.redis.existingSecrets }}
{{- else if .Values.externalServices.tradapi.redis.existingSecrets }}
  {{- print .Values.externalServices.tradapi.redis.existingSecrets }}
{{- else }}
  {{- print (include "tradapi.fullname" .) "-cache-credentials" }}
{{- end }}
{{- end }}