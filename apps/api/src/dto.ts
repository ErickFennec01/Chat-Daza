import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

export class CreateEmpresaDto {
  @IsString() @Length(2, 240) razaoSocial!: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsOptional() @IsUUID() empresaErpId?: string;
}

export class CreateApiKeyDto { @IsString() @Length(2, 120) nome!: string; }

export class CreateUserDto {
  @IsString() @Length(2, 160) nome!: string;
  @IsString() @Length(5, 320) @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) email!: string;
  @IsString() @Length(12, 160) senha!: string;
  @IsIn(['admin', 'operador']) papel!: 'admin' | 'operador';
}

export class LoginDto {
  @IsString() @Length(5, 320) @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) email!: string;
  @IsString() @Length(1, 160) senha!: string;
}

export class UpsertAgentDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @Length(2, 120) nome!: string;
  @IsString() @Length(0, 20_000) systemPrompt!: string;
  @IsString() @Length(3, 160) modelo!: string;
  @Min(0) @Max(2) temperatura!: number;
  @Min(64) @Max(2000) limiteRespostaTokens!: number;
  @Min(0) @Max(1) limiarConfianca!: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class CreateDocumentoDto {
  @IsString() @Length(2, 240) titulo!: string;
  @IsString() @Length(1, 200_000) conteudo!: string;
  @IsOptional() @IsString() @Length(0, 1000) fonte?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class UpdateDocumentoDto {
  @IsOptional() @IsString() @Length(2, 240) titulo?: string;
  @IsOptional() @IsString() @Length(1, 200_000) conteudo?: string;
  @IsOptional() @IsString() @Length(0, 1000) fonte?: string;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class ResolveQuestionDto {
  @IsIn(['em_revisao', 'respondida', 'descartada']) status!: 'em_revisao' | 'respondida' | 'descartada';
  @IsOptional() @IsString() @Length(1, 20_000) respostaCurada?: string;
}

export class AgentDecisionDto {
  @IsUUID() empresaId!: string;
  @IsUUID() conversaId!: string;
  @IsIn(['responder', 'escalar']) acao!: 'responder' | 'escalar';
  @IsString() @Length(1, 8000) resposta!: string;
  @IsOptional() @IsString() @Length(1, 2000) motivoEscalonamento?: string;
  @IsString() @Length(3, 160) modelo!: string;
  @IsOptional() ragCache?: boolean;
}

export class ListConversationsQueryDto {
  @IsOptional() @IsIn(['aberta', 'aguardando_humano', 'resolvida', 'encerrada']) status?: string;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit?: number;
}
