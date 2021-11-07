namespace WatchIt.API.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("[controller]")]
public abstract class BaseApiController : Controller
{
    public IMediator Mediator { get; set; }

    public BaseApiController(IMediator mediator)
    {
        this.Mediator = mediator;
    }
}

