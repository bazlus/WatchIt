namespace WatchIt.API.Controllers;

using MediatR;
using Microsoft.AspNetCore.Mvc;
using WatchIt.Application.Commands.CreateMovie;

public class MoviesController : BaseApiController
{
    public MoviesController(IMediator mediator) : base(mediator) { }

    [HttpPost]
    public IActionResult Create(CreateMovieRequest request)
    {
        var result = this.Mediator.Send(request);
        return Ok(result);
    }

    [HttpPost]
    public IActionResult Fetch(CreateMovieRequest request)
    {
        var result = this.Mediator.Send(request);
        return Ok(result);
    }
}

