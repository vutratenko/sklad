{{/*
Expand the name of the chart.
*/}}
{{- define "sklad.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "sklad.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "sklad.labels" -}}
helm.sh/chart: {{ include "sklad.name" . }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "sklad.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "sklad.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sklad.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
API image
*/}}
{{- define "sklad.apiImage" -}}
{{- $tag := default .Chart.AppVersion .Values.image.api.tag -}}
{{- printf "%s:%s" .Values.image.api.repository $tag }}
{{- end }}

{{/*
Web image
*/}}
{{- define "sklad.webImage" -}}
{{- $tag := default .Chart.AppVersion .Values.image.web.tag -}}
{{- printf "%s:%s" .Values.image.web.repository $tag }}
{{- end }}

{{/*
Secret name for API
*/}}
{{- define "sklad.apiSecretName" -}}
{{- if .Values.secrets.create }}
{{- include "sklad.fullname" . }}-api-secrets
{{- else }}
{{- .Values.api.existingSecret }}
{{- end }}
{{- end }}
