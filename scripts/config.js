const outputDir = './apps/api/src/app/features';
const controllerTemplate = 
`
import { Body, Controller, HttpService, Post } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
{{#methods}}
import { {{capitalize .}} } from './models/{{toLowerCase ../serviceName}}/{{.}}.class';
{{/methods}}
import { cmdaemonRemoteUrl } from '../configs/global.config';
import { ApiService } from '../services/api.service';

@ApiUseTags('{{toLowerCase serviceName}}')
@Controller('{{toLowerCase serviceName}}')
export class {{capitalize serviceName}}Controller {

  constructor(private http: HttpService, private apiService: ApiService) { }

{{#methods}}
  @Post('{{.}}')
  async {{.}}(@Body() request: {{capitalize .}}){
    return await this.apiService.executeApiRequest({
      ...request,
      service: '{{toLowerCase ../serviceName}}',
      call: '{{.}}'
    });
  }
{{/methods}}
}
`;


const typeFileTemplate = 
`
import { ApiModelProperty } from '@nestjs/swagger';

export class {{capitalize fileName }} {
  {{#inputs}}
  @ApiModelProperty()
  readonly {{ name }}: {{ type }};
  {{/inputs}}
}`;

const featuresModuleTemplate = `
import { Module, HttpModule } from '@nestjs/common';
{{#controllerNames}}import { {{.}}Controller } from './{{toLowerCase .}}.controller';
{{/controllerNames}}
import { ApiService } from '../services/api.service';

@Module({
  imports: [HttpModule],
  controllers: [
  {{#controllerNames}}
    {{.}}Controller,
  {{/controllerNames}}
  ],
  providers: [ApiService]
})
export class FeaturesModule {}

`;

module.exports = {
  controllerTemplate,
  featuresModuleTemplate,
  outputDir,
  typeFileTemplate
}