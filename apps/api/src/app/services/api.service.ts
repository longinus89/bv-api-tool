import { Injectable, HttpService } from '@nestjs/common';
import { first, map, mergeMap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import * as cookieParser from 'cookie';
import { cmdaemonRemoteUrl } from '../configs/global.config';

@Injectable()
export class ApiService {
  constructor(private http: HttpService) {}

  public login(): Observable<string> {
    return this.http.post(cmdaemonRemoteUrl, {
      username: "root", 
      password: "system",
      service: "login", 
      token: ""
    })
    .pipe(
      first(),
      map(
        response => `cm-login-token=${cookieParser.parse(response.headers['set-cookie'][0])['cm-login-token']}`
      )
    );
  }

  public async executeApiRequest (request) { 
    return await this.login()
      .pipe(
        mergeMap(token => this.http.post(cmdaemonRemoteUrl,
          request,
          {
            withCredentials: true,
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Connection': 'keep-alive',
              'Cookie': token,
              'Content-Type': 'application/json',
            },
          })
        ),
        map(response => response.data)
      ).toPromise().catch(err => console.log(err))        
  }
}