# 외부 접속 방법

## 같은 와이파이/사내망에서 접속

1. `start-lan.bat`을 실행합니다.
2. 이 PC와 같은 네트워크에 있는 기기에서 아래 주소로 접속합니다.
   - `http://10.86.5.86:4173`

창을 닫으면 접속도 종료됩니다.

## 이 PC에서만 실행

`start-local.bat`을 실행한 뒤 `http://127.0.0.1:4173`으로 접속합니다.

## 인터넷 전체 공개

### GitHub Pages 추천

이 폴더는 정적 웹앱이라 GitHub Pages에 그대로 올릴 수 있습니다.

1. GitHub에서 새 repository를 만듭니다.
2. 이 폴더 안의 파일들을 repository의 최상위에 업로드합니다.
   - `index.html`
   - `main.js`
   - `styles.css`
   - `vendor/three.global.js`
   - `.nojekyll`
3. GitHub repository에서 `Settings` → `Pages`로 들어갑니다.
4. `Build and deployment`에서 `Source`를 `Deploy from a branch`로 선택합니다.
5. Branch는 `main`, Folder는 `/ (root)`로 선택한 뒤 저장합니다.
6. 잠시 뒤 `https://사용자명.github.io/저장소명/` 주소로 접속합니다.

GitHub Pages는 공개 웹사이트가 됩니다. 이 폴더에는 민감한 정보가 없지만, 다른 파일을 함께 올릴 때는 개인 정보나 비밀키가 들어가지 않게 확인하세요.

### 다른 선택지

Netlify, Vercel, Cloudflare Pages 같은 정적 호스팅에도 같은 파일들을 그대로 올릴 수 있습니다. 임시 공개 링크가 필요하면 Cloudflare Tunnel 같은 터널을 붙이면 됩니다.
