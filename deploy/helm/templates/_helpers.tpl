{{/* vim: set filetype=mustache: */}}

{{/*
Expand the name of the chart.
*/}}
{{- define "vlibras.name" -}}
{{- default .Chart.Name .Values.global.appName | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Expand the name of the chart.
*/}}
{{- define "tradapi.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Expand the name of the release chart.
*/}}
{{- define "tradapi.release.name" -}}
{{- default .Release.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "tradapi.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Create chart name and version as used by the chart label. */}}
{{- define "tradapi.chartref" -}}
{{- replace "+" "_" .Chart.Version | printf "%s-%s" .Chart.Name -}}
{{- end }}

{{/* Generate basic labels */}}
{{- define "tradapi.labels" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: "{{ replace "+" "_" .Chart.Version }}"
app.kubernetes.io/part-of: {{ template "vlibras.name" . }}
chart: {{ template "tradapi.chartref" . }}
release: {{ $.Release.Name | quote }}
heritage: {{ $.Release.Service | quote }}
{{- if .Values.commonLabels}}
{{ toYaml .Values.commonLabels }}
{{- end }}
{{- end }}


{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "tradapi-name.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-tradapi" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}