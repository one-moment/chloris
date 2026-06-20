# GitHub 업로드 안내

원격 저장소:

```text
https://github.com/one-moment/chloris.git
```

## 맥북에서 업로드

현재 작업물 폴더의 파일을 맥북으로 옮긴 뒤 아래 명령을 실행합니다.

```bash
cd chloris
git init
git branch -M main
git remote add origin https://github.com/one-moment/chloris.git
git add .
git commit -m "Initial Chloris commit"
git push -u origin main
```

이미 `git clone`을 먼저 했다면 다음 순서로 진행합니다.

```bash
git clone https://github.com/one-moment/chloris.git
cd chloris
```

그다음 MVP 파일들을 복사하고 실행합니다.

```bash
git add .
git commit -m "Initial Chloris commit"
git push -u origin main
```

## 실행 확인

```bash
python3 -m http.server 4173
```

```text
http://127.0.0.1:4173
```
