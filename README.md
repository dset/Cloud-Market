# Cloud Market
https://www.youtube.com/watch?v=n020fVRDgDc

I built this to try out some technologies.

## Backend
Node + Hapi + Firestore, hosted on Google App Engine.

Google sign-in using Firebase authentication. Orders are associated with the user's Google account, which is used in order matching and access management.

## Frontend
Angular + Bootstrap.

## CI/CD
Github Actions. Every push to master will build and deploy to Google App Engine.
