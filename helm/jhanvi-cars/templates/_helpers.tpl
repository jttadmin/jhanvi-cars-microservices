{{/*
Common labels
*/}}
{{- define "jhanvi-cars.labels" -}}
app.kubernetes.io/name: jhanvi-cars
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end }}

{{/*
Service name
*/}}
{{- define "jhanvi-cars.serviceName" -}}
{{- printf "%s" .service -}}
{{- end }}
