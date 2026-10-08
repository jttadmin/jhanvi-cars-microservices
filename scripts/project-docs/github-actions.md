name: CI/CD to EKS

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    env:
      ECR_REPO: ${{ secrets.ECR_REPO }}
      IMAGE_TAG: ${{ github.sha }}

    steps:
    # 1️⃣ Checkout
    - name: Checkout repository
      uses: actions/checkout@v4

    # 2️⃣ AWS Credentials
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    # 3️⃣ Java Setup
    - name: Set up JDK 11
      uses: actions/setup-java@v4
      with:
        distribution: 'temurin'
        java-version: '11'

    # 4️⃣ Build
    - name: Maven package
      run: mvn clean package -DskipTests

    # 5️⃣ Sonar Scan
    - name: SonarQube Scan
      uses: SonarSource/sonarcloud-github-action@v2
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      with:
        args: >
          -Dsonar.projectKey=my-project
          -Dsonar.organization=my-org
          -Dsonar.host.url=${{ secrets.SONAR_HOST_URL }}

    # 6️⃣ Quality Gate
    - name: SonarQube Quality Gate
      uses: SonarSource/sonarqube-quality-gate-action@v1
      timeout-minutes: 5
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

    # 7️⃣ Tests
    - name: Run tests
      run: mvn test

    # 8️⃣ ECR Login
    - name: Login to Amazon ECR
      uses: aws-actions/amazon-ecr-login@v2

    # 9️⃣ Build & Push Docker
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile
        push: true
        tags: ${{ env.ECR_REPO }}:${{ env.IMAGE_TAG }}

    # 🔟 kubectl setup
    - name: Set up kubectl
      uses: azure/setup-kubectl@v4
      with:
        version: 'v1.27.0'

    # 11️⃣ Configure EKS
    - name: Configure kubeconfig
      run: |
        aws eks update-kubeconfig \
          --name ${{ secrets.EKS_CLUSTER_NAME }} \
          --region us-east-1

    # 12️⃣ Deploy
    - name: Deploy to EKS
      run: |
        cat <<EOF > deployment.yaml
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: my-app
          namespace: production
        spec:
          replicas: 3
          strategy:
            type: RollingUpdate
            rollingUpdate:
              maxSurge: 1
              maxUnavailable: 0
          selector:
            matchLabels:
              app: my-app
          template:
            metadata:
              labels:
                app: my-app
            spec:
              containers:
              - name: my-app
                image: ${ECR_REPO}:${IMAGE_TAG}
                ports:
                - containerPort: 8080
        EOF

        kubectl apply -f deployment.yaml
        kubectl rollout status deployment/my-app -n production